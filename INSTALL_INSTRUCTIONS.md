# Google Drive Sync - Installatie Instructies

## Stap 1: Pauzeer Google Drive Sync

1. **Klik op Google Drive icoon** in je systray (rechtsonder bij de klok)
2. **Klik op het tandwiel** (Settings)
3. **Klik op "Pause syncing"** of "Pauzeer synchronisatie"
4. **Kies**: "Pause for 1 hour" (of langer)

## Stap 2: Installeer Frontend Dependencies

Open PowerShell en run:

```powershell
cd "G:\My Drive\_Agentboss\SalesAgent\code\salesprep-ai\frontend"
npm install
```

Dit duurt 2-3 minuten. Je ziet veel output - dat is normaal.

**Als je errors ziet**:
- Probeer: `npm install --legacy-peer-deps`
- Of: `npm install --force`

## Stap 3: Installeer Backend Dependencies

```powershell
cd "G:\My Drive\_Agentboss\SalesAgent\code\salesprep-ai\backend"

# Maak virtual environment
python -m venv venv

# Activeer virtual environment
.\venv\Scripts\activate

# Installeer dependencies
pip install -r requirements.txt
```

## Stap 4: Hervat Google Drive Sync

1. **Klik weer op Google Drive icoon**
2. **Klik op "Resume syncing"** of "Hervat synchronisatie"

## Stap 5: Verifieer Installatie

### Check Frontend:
```powershell
cd "G:\My Drive\_Agentboss\SalesAgent\code\salesprep-ai\frontend"
npm run dev
```

Open browser: http://localhost:3000  
Je zou "Welcome to SalesPrep AI" moeten zien.

### Check Backend:
```powershell
cd "G:\My Drive\_Agentboss\SalesAgent\code\salesprep-ai\backend"
.\venv\Scripts\activate
python main.py
```

Open browser: http://localhost:8000  
Je zou JSON response moeten zien.

---

## Troubleshooting

### "npm: command not found"
- Node.js is niet geïnstalleerd
- Download: https://nodejs.org (LTS versie)

### "python: command not found"
- Python is niet geïnstalleerd
- Download: https://python.org (3.11+)
- Zorg dat "Add to PATH" aangevinkt is tijdens installatie

### npm install blijft hangen
- Druk Ctrl+C
- Probeer: `npm cache clean --force`
- Dan opnieuw: `npm install`

### pip install fails
- Zorg dat venv geactiveerd is (je ziet "(venv)" in prompt)
- Probeer: `python -m pip install --upgrade pip`
- Dan opnieuw: `pip install -r requirements.txt`

---

**Klaar? Laat me weten als alles geïnstalleerd is!**
