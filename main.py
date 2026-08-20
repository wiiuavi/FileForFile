import os
import sys
import platform
import threading
import tempfile
import socket
import json
import time
import winreg
import ctypes
import base64
import pandas as pd
from PIL import Image
import docx2pdf
import markdown
import pdfkit
import imgkit
import eel
import moviepy

try:
    import pystray
except ImportError:
    pystray = None

eel.init(os.path.dirname(os.path.abspath(__file__)))

keepBackground = False
trayIcon = None
startupSelectedFiles = []
startupQueueFile = os.path.join(tempfile.gettempdir(), "FileForFile-startup.json")

IMAGE_FORMATS = {"jpg", "jpeg", "png", "webp", "bmp", "gif", "tiff", "ico"}
VIDEO_FORMATS = {"mp4", "avi", "mkv", "mov", "webm"}
AUDIO_FORMATS = {"mp3", "wav", "ogg", "flac"}
DOCUMENT_FORMATS = {"docx", "xlsx", "pptx", "txt", "rtf", "md", "csv", "json", "html"}

def deleteRegistryKey(key, subKey):
    try:
        openKey = winreg.OpenKey(key, subKey, 0, winreg.KEY_ALL_ACCESS)
        info = winreg.QueryInfoKey(openKey)
        for i in range(info[0]):
            sub = winreg.EnumKey(openKey, 0)
            deleteRegistryKey(openKey, sub)
        winreg.CloseKey(openKey)
        winreg.DeleteKey(key, subKey)
    except OSError:
        pass

def getContextMenuIconPath():
    baseDir = os.path.dirname(os.path.abspath(__file__))
    pngPath = os.path.join(baseDir, "icon.png")
    icoPath = os.path.join(baseDir, "icon.ico")

    if os.path.exists(pngPath):
        try:
            needsUpdate = not os.path.exists(icoPath) or os.path.getmtime(icoPath) < os.path.getmtime(pngPath)
            if needsUpdate:
                image = Image.open(pngPath)
                image.save(icoPath, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
        except Exception:
            return pngPath

    if os.path.exists(icoPath):
        return icoPath
    return pngPath

@eel.expose
def setBackgroundMode(val):
    global keepBackground
    keepBackground = val

@eel.expose
def getStartupFiles():
    return startupSelectedFiles

@eel.expose
def clearStartupFiles():
    global startupSelectedFiles
    startupSelectedFiles = []

@eel.expose
def saveImageFromBase64(base64Data, filename):
    try:
        if "," in base64Data:
            base64Data = base64Data.split(",")[1]
        imageData = base64.b64decode(base64Data)
        downloadsDir = os.path.expanduser('~/Downloads')
        filePath = os.path.join(downloadsDir, filename)
        with open(filePath, "wb") as f:
            f.write(imageData)
        return True, filePath
    except Exception as e:
        return False, str(e)

def isAppAlreadyRunning():
    try:
        with socket.create_connection(("127.0.0.1", 8000), timeout=0.2):
            return True
    except OSError:
        return False

def writeStartupFiles(filePaths):
    try:
        with open(startupQueueFile, "w", encoding="utf-8") as fileHandle:
            json.dump(filePaths, fileHandle)
        return True
    except OSError:
        return False

def readStartupFilesFromQueue():
    try:
        if not os.path.exists(startupQueueFile):
            return []
        with open(startupQueueFile, "r", encoding="utf-8") as fileHandle:
            filePaths = json.load(fileHandle)
        os.remove(startupQueueFile)
        return [path for path in filePaths if os.path.exists(path)]
    except Exception:
        return []

def watchStartupQueue():
    global startupSelectedFiles
    lastSeenMtime = 0
    while True:
        try:
            if os.path.exists(startupQueueFile):
                currentMtime = os.path.getmtime(startupQueueFile)
                if currentMtime > lastSeenMtime:
                    lastSeenMtime = currentMtime
                    queuedFiles = readStartupFilesFromQueue()
                    if queuedFiles:
                        startupSelectedFiles = queuedFiles[:1]
            time.sleep(0.5)
        except Exception:
            time.sleep(0.5)

conversionGraph = {
    "docx": ["pdf", "txt"],
    "xlsx": ["csv", "json"],
    "pptx": ["pdf"],
    "txt": ["pdf", "md", "csv", "json"],
    "rtf": ["pdf", "txt"],
    "md": ["pdf", "txt", "html"],
    "csv": ["xlsx", "json", "txt"],
    "json": ["csv", "txt", "xlsx"],
    "html": ["pdf", "txt", "jpg", "jpeg", "png"],
    "jpg": ["jpeg", "png", "webp", "bmp", "gif", "tiff", "ico", "pdf"],
    "jpeg": ["jpg", "png", "webp", "bmp", "gif", "tiff", "ico", "pdf"],
    "png": ["jpg", "jpeg", "webp", "bmp", "gif", "tiff", "ico", "pdf"],
    "webp": ["jpg", "jpeg", "png", "bmp", "gif", "tiff", "ico"],
    "gif": ["jpg", "jpeg", "png", "webp", "bmp", "mp4"],
    "mp4": ["mp3", "wav", "avi", "mkv", "mov", "webm", "gif"],
    "avi": ["mp4", "mkv", "mov", "webm", "mp3", "wav"],
    "mkv": ["mp4", "avi", "mov", "webm", "mp3", "wav"],
    "mov": ["mp4", "avi", "mkv", "webm", "mp3", "wav"],
    "webm": ["mp4", "avi", "mkv", "mov", "mp3", "wav"],
    "mp3": ["wav", "ogg", "flac"],
    "wav": ["mp3", "ogg", "flac"],
    "ogg": ["mp3", "wav", "flac"],
    "flac": ["mp3", "wav", "ogg"]
}

formatDescriptions = {
    "pdf": "Portable Document Format",
    "mp3": "Standard audio file",
    "docx": "Word document"
}

@eel.expose
def toggleRegistryContextMenu(enable):
    try:
        iconPath = getContextMenuIconPath()
        exePath = sys.executable
        scriptPath = os.path.abspath(__file__)
        isFrozen = getattr(sys, 'frozen', False)
        
        for ext, targets in conversionGraph.items():
            basePath = f"Software\\Classes\\SystemFileAssociations\\.{ext}\\shell\\FileForFile"
            if enable:
                key = winreg.CreateKey(winreg.HKEY_CURRENT_USER, basePath)
                winreg.SetValueEx(key, "MUIVerb", 0, winreg.REG_SZ, "FileForFile")
                if os.path.exists(iconPath):
                    winreg.SetValueEx(key, "Icon", 0, winreg.REG_SZ, iconPath)

                cmdKey = winreg.CreateKey(key, "command")
                if isFrozen:
                    cmd = f'"{exePath}" "%1"'
                else:
                    cmd = f'"{exePath}" "{scriptPath}" "%1"'

                winreg.SetValue(cmdKey, "", winreg.REG_SZ, cmd)
                winreg.CloseKey(cmdKey)
                winreg.CloseKey(key)
            else:
                deleteRegistryKey(winreg.HKEY_CURRENT_USER, basePath)
        return True, ""
    except Exception as e:
        return False, str(e)

def getFileExtension(filePath):
    if '.' in filePath:
        return filePath.split('.')[-1].lower()
    return ""

@eel.expose
def getFileFormats():
    allFormats = set()
    for inputType, outputTypes in conversionGraph.items():
        allFormats.add(inputType)
        for outputType in outputTypes:
            allFormats.add(outputType)
    formatList = []
    for fmt in sorted(list(allFormats)):
        formatList.append({
            "title": fmt.upper(),
            "description": formatDescriptions.get(fmt, "")
        })
    return formatList

@eel.expose
def getFormatsICanConvertTo(inputFormat):
    normalizedFormat = inputFormat.lower().replace('.', '')
    if normalizedFormat in conversionGraph:
        return conversionGraph[normalizedFormat]
    return []

@eel.expose
def getFormatsICanConvertFrom(outputFormat):
    normalizedFormat = outputFormat.lower().replace('.', '')
    supportedInputs = []
    for inputType, outputTypes in conversionGraph.items():
        if normalizedFormat in outputTypes:
            supportedInputs.append(inputType)
    return supportedInputs

@eel.expose
def convertImageToImage(inputFile, outputFile):
    try:
        with Image.open(inputFile) as img:
            rgbImg = img.convert("RGB")
            rgbImg.save(outputFile)
        return True, ""
    except Exception as e:
        return False, str(e)

@eel.expose
def convertVideoToVideo(inputFile, outputFile):
    try:
        clip = moviepy.VideoFileClip(inputFile)
        clip.write_videofile(outputFile)
        return True, ""
    except Exception as e:
        return False, str(e)

@eel.expose
def convertAudioToAudio(inputFile, outputFile):
    try:
        clip = moviepy.AudioFileClip(inputFile)
        clip.write_audiofile(outputFile)
        return True, ""
    except Exception as e:
        return False, str(e)

@eel.expose
def convertVideoToAudio(inputFile, outputFile):
    try:
        clip = moviepy.VideoFileClip(inputFile)
        clip.audio.write_audiofile(outputFile)
        return True, ""
    except Exception as e:
        return False, str(e)

@eel.expose
def convertTextToText(inputFile, outputFile):
    inExt = getFileExtension(inputFile)
    outExt = getFileExtension(outputFile)
    try:
        if inExt == 'csv' and outExt == 'xlsx':
            pd.read_csv(inputFile).to_excel(outputFile, index=False)
        elif inExt == 'xlsx' and outExt == 'csv':
            pd.read_excel(inputFile).to_csv(outputFile, index=False)
        elif inExt == 'csv' and outExt == 'json':
            pd.read_csv(inputFile).to_json(outputFile, orient='records')
        elif inExt == 'json' and outExt == 'csv':
            pd.read_json(inputFile).to_csv(outputFile, index=False)
        else:
            with open(inputFile, 'r', encoding='utf-8') as inFile:
                content = inFile.read()
            with open(outputFile, 'w', encoding='utf-8') as outFile:
                outFile.write(content)
        return True, ""
    except Exception as e:
        return False, str(e)

@eel.expose
def convertHtmlToImage(inputFile, outputFile):
    try:
        imgConfig = None
        if platform.system() == 'Windows':
            baseDir = os.path.dirname(os.path.abspath(__file__))
            if getattr(sys, 'frozen', False):
                baseDir = os.path.dirname(sys.executable)
            expectedPath = os.path.join(baseDir, 'bin', 'wkhtmltoimage.exe')
            if os.path.exists(expectedPath):
                imgConfig = imgkit.config(wkhtmltoimage=expectedPath)
        
        if imgConfig:
            imgkit.from_file(inputFile, outputFile, config=imgConfig)
        else:
            imgkit.from_file(inputFile, outputFile)
        return True, ""
    except Exception as e:
        return False, str(e)

@eel.expose
def convertToPdf(inputFile, outputFile):
    inExt = getFileExtension(inputFile)
    try:
        if inExt == 'docx':
            docx2pdf.convert(inputFile, outputFile)
        elif inExt in ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'ico']:
            with Image.open(inputFile) as img:
                rgbImg = img.convert("RGB")
                rgbImg.save(outputFile, "PDF")
        else:
            pdfConfig = None
            if platform.system() == 'Windows':
                baseDir = os.path.dirname(os.path.abspath(__file__))
                if getattr(sys, 'frozen', False):
                    baseDir = os.path.dirname(sys.executable)
                expectedPath = os.path.join(baseDir, 'bin', 'wkhtmltopdf.exe')
                if os.path.exists(expectedPath):
                    pdfConfig = pdfkit.configuration(wkhtmltopdf=expectedPath)
            
            if inExt == 'md':
                with open(inputFile, 'r', encoding='utf-8') as f:
                    htmlText = markdown.markdown(f.read())
                htmlWrapper = f'<html><head><meta charset="utf-8"></head><body>{htmlText}</body></html>'
                if pdfConfig:
                    pdfkit.from_string(htmlWrapper, outputFile, configuration=pdfConfig)
                else:
                    pdfkit.from_string(htmlWrapper, outputFile)
            elif inExt == 'txt':
                with open(inputFile, 'r', encoding='utf-8') as f:
                    txtContent = f.read()
                safeTxt = txtContent.replace('<', '&lt;').replace('>', '&gt;')
                htmlWrapper = f'<html><head><meta charset="utf-8"></head><body><pre style="white-space: pre-wrap; word-wrap: break-word; font-family: sans-serif;">{safeTxt}</pre></body></html>'
                if pdfConfig:
                    pdfkit.from_string(htmlWrapper, outputFile, configuration=pdfConfig)
                else:
                    pdfkit.from_string(htmlWrapper, outputFile)
            elif inExt in ['rtf', 'html']:
                if pdfConfig:
                    pdfkit.from_file(inputFile, outputFile, configuration=pdfConfig)
                else:
                    pdfkit.from_file(inputFile, outputFile)
        return True, ""
    except Exception as e:
        return False, str(e)

import tkinter as tk
from tkinter import filedialog

@eel.expose
def askForFiles():
    root = tk.Tk()
    root.attributes('-topmost', True)
    root.withdraw()
    filePaths = filedialog.askopenfilenames()
    return list(filePaths)

@eel.expose
def askForFolder():
    root = tk.Tk()
    root.attributes('-topmost', True)
    root.withdraw()
    folderPath = filedialog.askdirectory()
    return folderPath

@eel.expose
def getDownloadsPath():
    return os.path.expanduser('~/Downloads')

@eel.expose
def getScriptPath():
    return os.path.abspath(os.path.dirname(__file__))

@eel.expose
def executeConversion(filePaths, targetFormat, saveLocationType, customPath):
    try:
        targetFormat = targetFormat.lower()
        outputFolder = ""
        
        if saveLocationType == 'downloads':
            outputFolder = os.path.expanduser('~/Downloads')
        elif saveLocationType == 'scriptFolder':
            outputFolder = os.path.abspath(os.path.dirname(__file__))
        elif saveLocationType == 'customFolder':
            outputFolder = customPath
            
        if not os.path.exists(outputFolder):
            return {'status': 'error', 'message': 'Output folder does not exist'}
            
        imageFormats = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'ico']
        videoFormats = ['mp4', 'avi', 'mkv', 'mov', 'webm']
        audioFormats = ['mp3', 'wav', 'ogg', 'flac']
        textFormats = ['txt', 'md', 'csv', 'json', 'html', 'rtf', 'docx', 'xlsx']
        
        for path in filePaths:
            fileName = os.path.basename(path)
            baseName = os.path.splitext(fileName)[0]
            inExt = os.path.splitext(fileName)[1].lower().replace('.', '')
            
            outputFile = os.path.join(outputFolder, baseName + '.' + targetFormat)
            success = False
            errMsg = "Unknown conversion error"
            
            if targetFormat == 'pdf':
                success, errMsg = convertToPdf(path, outputFile)
            elif inExt == 'html' and targetFormat in imageFormats:
                success, errMsg = convertHtmlToImage(path, outputFile)
            elif inExt in imageFormats and targetFormat in imageFormats:
                success, errMsg = convertImageToImage(path, outputFile)
            elif inExt in videoFormats and targetFormat in videoFormats:
                success, errMsg = convertVideoToVideo(path, outputFile)
            elif inExt in audioFormats and targetFormat in audioFormats:
                success, errMsg = convertAudioToAudio(path, outputFile)
            elif inExt in videoFormats and targetFormat in audioFormats:
                success, errMsg = convertVideoToAudio(path, outputFile)
            elif inExt in textFormats and targetFormat in textFormats:
                success, errMsg = convertTextToText(path, outputFile)
            elif inExt == 'gif' and targetFormat in videoFormats:
                success, errMsg = convertVideoToVideo(path, outputFile)
            
            if not success:
                return {'status': 'error', 'message': f'Failed {fileName}: {errMsg}'}
                
        return {'status': 'success', 'message': 'Conversion successful!'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}

def showMessage(title, msg):
    ctypes.windll.user32.MessageBoxW(0, msg, title, 0)

def openPage(icon, item):
    eel.show('index.html')

def quitApp(icon, item):
    if trayIcon:
        trayIcon.stop()
    os._exit(0)

def setupTray():
    global trayIcon
    if not pystray:
        return
    try:
        iconPath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icon.png")
        if os.path.exists(iconPath):
            image = Image.open(iconPath)
        else:
            image = Image.new('RGB', (64, 64), color='blue')
        
        menu = pystray.Menu(
            pystray.MenuItem("Open FileForFile", openPage, default=True),
            pystray.MenuItem("Close Script", quitApp)
        )
        trayIcon = pystray.Icon("FileForFile", image, "FileForFile", menu)
        trayIcon.run()
    except Exception as e:
        pass

def handleClose(page, sockets):
    if not keepBackground:
        if trayIcon:
            trayIcon.stop()
        os._exit(0)

if __name__ == '__main__':
    args = [arg for arg in sys.argv[1:] if not arg.startswith('--')]
    startupSelectedFiles = [os.path.abspath(arg) for arg in args if os.path.exists(arg)][:1]

    if isAppAlreadyRunning():
        if startupSelectedFiles:
            writeStartupFiles(startupSelectedFiles)
        sys.exit(0)

    if os.path.exists(startupQueueFile):
        try:
            os.remove(startupQueueFile)
        except OSError:
            pass

    if '--context' in sys.argv:
        try:
            idx = sys.argv.index('--context')
            if idx + 2 < len(sys.argv):
                filePath = sys.argv[idx + 1]
                targetFmt = sys.argv[idx + 2]
                outDir = os.path.dirname(filePath)
                res = executeConversion([filePath], targetFmt, 'customFolder', outDir)
                if res['status'] == 'success':
                    showMessage("Success", f"Converted to .{targetFmt} successfully!")
                else:
                    showMessage("Error", res['message'])
        except Exception as ex:
            showMessage("Error", str(ex))
        sys.exit(0)
        
    if pystray:
        threading.Thread(target=setupTray, daemon=True).start()
    threading.Thread(target=watchStartupQueue, daemon=True).start()
    
    eel.start('index.html', mode='default', block=False, close_callback=handleClose)
    
    while True:
        eel.sleep(1.0)