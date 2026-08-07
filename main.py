import eel
import os
import pandas as pd
import moviepy
from PIL import Image
import docx2pdf
import markdown
import pdfkit

eel.init('.')

conversionGraph = {
    "docx": ["pdf", "txt"],
    "xlsx": ["csv", "json"],
    "pptx": ["pdf"],
    "txt": ["pdf", "md", "csv", "json"],
    "rtf": ["pdf", "txt"],
    "md": ["pdf", "txt", "html"],
    "csv": ["xlsx", "json", "txt"],
    "json": ["csv", "txt", "xlsx"],
    "html": ["pdf", "txt"],
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
def getFileExtension(filePath):
    if '.' in filePath:
        return filePath.split('.')[-1].lower()
    return ""

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
        return True
    except:
        return False

@eel.expose
def convertVideoToVideo(inputFile, outputFile):
    try:
        clip = moviepy.VideoFileClip(inputFile)
        clip.write_videofile(outputFile)
        return True
    except:
        return False

@eel.expose
def convertAudioToAudio(inputFile, outputFile):
    try:
        clip = moviepy.AudioFileClip(inputFile)
        clip.write_audiofile(outputFile)
        return True
    except:
        return False

@eel.expose
def convertVideoToAudio(inputFile, outputFile):
    try:
        clip = moviepy.VideoFileClip(inputFile)
        clip.audio.write_audiofile(outputFile)
        return True
    except:
        return False

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
        return True
    except:
        return False

@eel.expose
def convertToPdf(inputFile, outputFile):
    inExt = getFileExtension(inputFile)
    try:
        if inExt == 'docx':
            docx2pdf.convert(inputFile, outputFile)
        elif inExt in ['jpg', 'jpeg', 'png', 'webp']:
            with Image.open(inputFile) as img:
                rgbImg = img.convert("RGB")
                rgbImg.save(outputFile, "PDF")
        elif inExt == 'md':
            with open(inputFile, 'r', encoding='utf-8') as f:
                htmlText = markdown.markdown(f.read())
            pdfkit.from_string(htmlText, outputFile)
        elif inExt in ['txt', 'rtf', 'html']:
            pdfkit.from_file(inputFile, outputFile)
        return True
    except:
        return False

if __name__ == '__main__':
    eel.start('index.html', mode='default')