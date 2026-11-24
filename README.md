# V.E.G.A

Voglio creare un'applicazione web che funga da mediatore e pannello di controllo centralizzato per un assistente AI avanzato (stile JARVIS). L'applicazione deve avere un design scuro, minimale e futuristico (colori nero/antracite con accenti blu neon/ciano, font tech/monospace). 

Per questa prima fase (STEP 1), concentrati esclusivamente sulla struttura dell'interfaccia, sulla navigazione e sulla memoria base della chat.

1. INTERFACCIA E NAVIGAZIONE (Il Guscio)

- Crea una barra laterale di navigazione fissa con le seguenti voci (ciascuna con un'icona tech):

  * Chat Principale (La schermata attiva di default)

  * Rete & Ollama (Configurazione connessione)

  * Produttività (Calendario & Email)

  * Informazioni (News & Meteo)

  * Diario & Documenti (Note personali)

  * Stato Sistema & Media

2. SCHERMATA CHAT PRINCIPALE (Il nucleo attivo)

- Una chat fluida ed elegante per dialogare con Jarvis.

- Collega un database (usa Supabase nativo di Lovable) per salvare la cronologia dei messaggi (utente e assistente). Quando l'app si ricarica o viene aperta da un altro dispositivo, la cronologia deve rimanere salvata.

3. PREDISPOSIZIONE DELLE ALTRE SCHERMATE (I moduli futuri)

- Per le altre voci della barra laterale (Ollama, Produttività, Informazioni, Diario, Stato Sistema), crea per ora delle semplici schermate provvisorie ("placeholder") coerenti con il design futuristico. Inserisci in ognuna un messaggio del tipo "Modulo [Nome Modulo] integrato a livello grafico. Pronto per l'attivazione logica nello Step successivo."

LINEE GUIDA PER LO SVILUPPO:

- Concentrati sulla stabilità della chat e del database Supabase. Non implementare ancora le chiamate API reali a Google, Ollama o servizi meteo; limitati a far funzionare la chat simulando una risposta iniziale di Jarvis per testare che il database registri tutto correttamente.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://chat-and-control-haven.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/31ea4d2c-1f14-5aa4-973d-692173241919).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
