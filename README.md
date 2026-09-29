# Frameworks · sito v0.2

Sito di Frameworks (Adaptive Content Systems) con **Console a nodi** su desktop, **feed verticale** su mobile, **backoffice** per i contenuti, **Radar** (rassegna da fonti esterne con filtri e classificazione AI), **AI interattiva** (Console prompt e "Adatta al tuo contesto") e **modalità ambientali** (tempo a disposizione, umore, meteo di Roma).

Stack: Node.js 20+ · Express · SQLite (better-sqlite3) · EJS · GSAP. Nessun servizio esterno obbligatorio oltre alla chiave AI (Anthropic o OpenAI) e a Open-Meteo (gratuito, senza chiave) per il meteo.

## Struttura

```
server/        index.js (app), db.js (SQLite + seed), admin.js (backoffice), ai.js (Anthropic/OpenAI),
               feeds.js (Radar RSS), weather.js (meteo Roma)
views/         index.ejs (sito), admin/*.ejs (backoffice), partials/
public/        css/site.css, css/admin.css, js/site.js, media/ (immagini generate con FAC)
content/       seed.json (contenuti iniziali: caricati nel database al primo avvio)
scripts/       build-preview.js (versione statica per l'anteprima)
data/          site.db + uploads/ (creata al primo avvio; NON va nel repository)
render.yaml    blueprint per il deploy su Render
```

## 1. Avvio in locale

1. Installa Node.js 20 o superiore (https://nodejs.org).
2. Apri il Terminale nella cartella del progetto ed esegui: `npm install`
3. Crea il file delle variabili: `cp .env.example .env`
4. Apri `.env` e imposta almeno: `ADMIN_PASSWORD=` (una password tua) e `SESSION_SECRET=` (una stringa lunga a caso).
5. Avvia: `npm start`
6. Apri http://localhost:3000 (sito) e http://localhost:3000/admin (backoffice, utente `admin`).

Al primo avvio il database viene creato in `data/site.db` e riempito con i contenuti di `content/seed.json`. Da quel momento i contenuti si modificano **solo dal backoffice** (il seed non viene più letto).

## 2. Backoffice (/admin)

Il backoffice è organizzato come un CMS: a sinistra i gruppi (Sito, Collezioni, Radar, Console e AI, Sistema), a destra la pagina.

- **Contenuti** (`/admin/contenuti`): tutte le scritte del sito, una pagina per sezione nell'ordine in cui le sezioni compaiono (menu, domande iniziali, hero, reel, servizi, contesto, lavori, organismo, metodo, team, tecnologie, radar, narrowcasting, triade, chiusura, contatti, app mobile, modalità). Ogni campo mostra il testo standard come suggerimento: vuoto = standard, scritto = personalizzato (e si traduce da solo in inglese). Gli elementi facoltativi (sottotitoli, note, frasi in corsivo, il blocco viola della schermata Sistema…) hanno la casella «Mostra»: spenta, l'elemento non compare (la chiave finisce in `site.hidden`). I blocchi interi, invece, si accendono e spengono per tempo dalla pagina Fruizione. Lo schema dei campi, con etichette, spiegazioni e testi standard, è in `server/site-fields.js`: per rendere modificabile una nuova scritta si aggiunge lì il campo e nel template si usa `site.<chiave>`.
- **Fruizione** (`/admin/fruizione`): cosa si vede, in che ordine e in che forma in base al tempo scelto dal visitatore (2 minuti · 10 minuti · tutto il tempo). Una riga per ogni sezione del desktop e per ogni blocco delle schermate mobile Home e Sistema: le frecce cambiano l'ordine di apparizione, per ogni tempo si sceglie **nascosta / breve / completa**. "Breve" esiste solo per alcune sezioni (servizi, contesto, organismo, metodo, team, tecnologie, radar): i servizi diventano un blocco unico con le 4 aree senza rimandi alle schede, le altre mostrano il testo breve scritto in Contenuti (vuoto = completa). Registro, valori standard e lettura del form in `server/layout.js`; sul sito ogni sezione porta `data-v2/data-v10/data-vall` e il CSS (`html[data-density]`) nasconde la sezione o la parte `.v-full`/`.v-brief`; su mobile lo fa `App.applyDensity`. In fondo alla pagina le **priorità** (1 = sempre · 2 = da 10 minuti · 3 = solo con tutto il tempo) di lavori e reel, che si impostano anche dalle rispettive schede: gli elementi portano `data-prio` e spariscono via CSS oltre il livello del tempo scelto (`server/priority.js`; le priorità dei lavori stanno nel setting `priority`, quelle dei reel nel reel).
- **Aree**: i quattro sistemi (nodi principali della Console), con immagine, tag, tecnologie e casi d'uso. Ogni caso d'uso può avere un visual (menu accanto alla riga: i 23 visual standard stanno in `public/media/usi/`, con le versioni piccole in `usi/sm/`): con i visual, la scheda dell'area e la versione breve mostrano i casi d'uso come card a carosello (immagine + didascalia); senza, restano un elenco puntato.
- **Lavori**: cliente, titolo, descrizione, aree collegate, immagine (URL, media caricati o upload diretto), video di copertina (Vimeo o mp4), stato (placeholder / proposta / in corso / consegnato), priorità 1-2-3, e una **galleria** di foto e video (mp4/webm o Vimeo, con didascalia facoltativa; upload di più file insieme) che nella scheda del lavoro segue la copertina in un carosello — sta nel setting `works_gallery` (`server/gallery.js`).
- **Radar**: notizie in attesa (con punteggio e bozza AI), pubblicate, scartate; pulsante "Esegui il Radar ora"; inserimento manuale.
- **Fonti e filtri**: feed RSS (attiva/disattiva, peso), parole chiave incluse/escluse, età massima, notizie per giro, intervallo, classificazione AI, auto-pubblicazione.
- **AI**: provider, chiavi, modelli, funzioni attive, limite giornaliero, test di connessione, consumi.
- **Media**: upload di immagini e video (salvati in `data/uploads`, serviti su `/media/...`).
- **Panoramica**: accesso rapido alle sezioni dei contenuti, stato del Radar e dell'AI, export JSON di tutti i contenuti e import.

## 3. Attivare l'AI

1. Crea una chiave API su https://console.anthropic.com (Anthropic) oppure https://platform.openai.com (OpenAI).
2. Mettila in `.env` come `ANTHROPIC_API_KEY=...` (o `OPENAI_API_KEY=...`) **oppure** incollala in `/admin/ai`.
3. In `/admin/ai` scegli il provider attivo e premi "Salva e prova la connessione".
4. Da quel momento sul sito compaiono la barra "Chiedi alla Console" (desktop e mobile) e il Radar inizia a classificare le notizie. Il pannello "Adatta al tuo contesto" (tre idee) nelle schede dei lavori e delle aree è spento di serie: si accende in Contenuti → Lavori («Scheda del lavoro») e Contenuti → Servizi («Scheda dell'area»), oltre che qui.

Costi sotto controllo: le risposte uguali sono in cache (Console 24 ore, Adatta 7 giorni), limite di 20 richieste al minuto per visitatore e limite giornaliero impostabile.

## 4. Radar (contenuti di terzi)

Il Radar legge le fonti ogni N ore (default 6) e un minuto dopo ogni avvio. Le notizie che superano i filtri finiscono **in attesa**: le pubblichi tu (o, se attivi l'auto-pubblicazione, passano da sole quelle con punteggio AI ≥ 70). Sul sito i contenuti del Radar sono sempre distinti dai nostri: sezione su fondo carta, chip "Fonte esterna", titolo tra virgolette e link alla fonte, "La nostra lettura" separata. Nella Console sono i punti chiari sull'anello esterno.

## 5. Deploy su Render (repository GitHub WHYsrl/fwksite)

Il repository è `https://github.com/WHYsrl/fwksite.git`. Il file `render.yaml` descrive l'infrastruttura: web service **Standard** (2 GB RAM, sempre acceso, regione Francoforte) e **disco persistente da 5 GB** in `/var/data` per database e upload.

Primo push (una volta sola, dal Mac, nella cartella del progetto):

1. `git remote -v` — se il remote `origin` non c'è: `git remote add origin https://github.com/WHYsrl/fwksite.git`
2. `git push -u origin main` (GitHub chiede le credenziali la prima volta: usa un Personal Access Token come password, oppure `gh auth login` se hai la CLI di GitHub).

Deploy:

1. Vai su https://dashboard.render.com → **New** → **Blueprint**.
2. Collega l'account GitHub di WHYsrl (se non lo è già) e scegli il repository `WHYsrl/fwksite`, branch `main`.
3. Render legge `render.yaml` e mostra il servizio `frameworks-site` con il disco `fwks-data`. Nel modulo compila le variabili richieste: `ADMIN_PASSWORD` (password del backoffice) e `ANTHROPIC_API_KEY` oppure `OPENAI_API_KEY` (lascia vuota quella che non usi). `SESSION_SECRET` viene generata da Render.
4. Premi **Apply**: build (`npm ci`) e avvio richiedono 2-3 minuti. A fine deploy apri l'URL `https://frameworks-site.onrender.com` (o il nome assegnato): sito su `/`, backoffice su `/admin`.
5. Dominio: Render → servizio → **Settings** → **Custom Domains** → **Add** → `frameworks.frame.it` (o il dominio scelto). Nel DNS di frame.it crea il record **CNAME** `frameworks` → `frameworks-site.onrender.com` (Render mostra il valore esatto). Il certificato HTTPS viene emesso da Render in automatico.
6. Ogni `git push` su `main` fa un nuovo deploy (autoDeploy). Il database e gli upload restano sul disco tra un deploy e l'altro.

Costi indicativi (settembre 2026): Standard ~25 $/mese + disco 5 GB ~1,25 $/mese. Per un backup periodico scarica l'export JSON dalla dashboard del backoffice; le immagini caricate stanno in `/var/data/uploads`.

## 6. Anteprima statica

`npm run preview` genera `preview/index.html` (contenuti del seed, senza server): è la versione usata per l'artifact di anteprima. Le funzioni AI nell'anteprima usano la capability "sample" dell'artifact, in produzione le API del server.

## 7. Versione inglese

Il sito è bilingue (it/en). Lingua della pagina: `/it` e `/en` la forzano e la ricordano in un cookie (`fw_lang`); `/` usa il cookie o, se manca, la lingua del browser (italiano → it, tutto il resto → en). L'inglese "dal browser" e il selettore IT/EN (desktop: barra in alto e pannello Modalità; mobile: dentro la Console, insieme a mood e tempo) compaiono solo quando la versione inglese è stata resa pubblica da **/admin/inglese**; prima di allora l'inglese si vede solo aprendo `/en`.

- **Interfaccia** (menu, bottoni, didascalie, messaggi della Console e dell'Organismo): dizionario in `public/js/i18n.js`, chiave = testo italiano com'è scritto nel codice, valore = inglese. Lo usano il server (template EJS, `t("…")`) e il browser (`site.js`, `organismo.js`, `reels.js`, `datafield.js`). Una chiave che manca resta in italiano: si vede e si aggiunge lì.
- **Contenuti** (testi del sito, aree, lavori, team, letture e riassunti del Radar, reel, dati del contesto): li traduce l'AI (stessa chiave di /admin/ai) campo per campo, nella tabella `translations` (`server/i18n.js`); si ritraduce solo ciò che manca o il cui testo italiano è cambiato. Parte da sola all'avvio, dopo ogni modifica dal backoffice e dopo ogni giro del Radar, oppure a mano da /admin/inglese, dove ogni campo si può correggere: la correzione resta finché l'italiano non cambia.
- **AI**: Console e "Adatta al tuo contesto" rispondono in inglese quando la pagina è in inglese (`lang` nelle chiamate a `/api/ai/*`).
- Restano in italiano: il backoffice e le pagine a sé dell'Organismo (`/organismo`, secondo schermo, AR).

## Note

- **Font**: Helvetica Now Display (brand) è self-hosted in `public/fonts` (woff2 nei pesi 300/400/500/700/800, convertiti dagli OTF della cartella `font/`); Geist Mono per i dati e Instrument Serif come sostituto di GT Super Display arrivano da Google Fonts. Quando avrai i file di GT Super (e di Auger Mono, la cartella è vuota), si mettono in `public/fonts` e si aggiungono i `@font-face` in `site.css`.
- **Logo**: il simbolo inline `#fw-logo` in `views/index.ejs` è generato dal file ufficiale `logo/Svg/Frameworks_bianco.svg` (cubo + wordmark, colore = `currentColor`); `#fw-mark` è il solo cubo (favicon).
- **Immagini**: quelle in `public/media/` sono placeholder generati con FAC (Seedream 5.0 Flash). Le immagini dei lavori si sostituiscono dal backoffice.
- **Video dei lavori**: nel backoffice il campo "Video" accetta un link Vimeo (`https://vimeo.com/ID/HASH`, il link "Non in elenco") oppure un URL mp4/webm; il video viene mostrato in loop muto nel dettaglio del lavoro, al posto dell'immagine (che resta la copertina della card). I loop dei casi sono nella cartella Vimeo "Frameworks / Case studies" (privacy: Non in elenco, incorporabile ovunque).
- **Patch di contenuto**: i file in `content/patches/*.json` (formato dell'export/import del backoffice) vengono applicati una sola volta ciascuno a ogni avvio, anche su un database già popolato: così un deploy aggiorna le schede in produzione. Una patch può anche contenere `works_update: [{ id, image: "..." }]` per cambiare solo alcuni campi di schede esistenti senza toccare il resto (utile per cover e video). I file applicati sono ricordati nel setting `patches_applied`; per riapplicarne uno, rinominalo o importalo dal backoffice.
- **Meteo**: Open-Meteo per Roma, cache 15 minuti; se non raggiungibile la pagina funziona lo stesso.
- **Sicurezza**: cambia `ADMIN_PASSWORD` e `SESSION_SECRET`; in produzione i cookie sono `secure`. Il backoffice non è indicizzato (noindex).
