# Østfold husflidslag
Vi utvikler en mer brukervennlig nettside for Østfold Husflidslag.

## Team
- Alan Qahraman Ahmed
- Bekuru Teklemichael
- Kristoffer Kvernsmyr
- Kristoffer Sjøboden
- Tim Emil Strudahl Malmo

## Installasjon
Krever Node.js 20 eller nyere og npm. Installer avhengigheter i begge prosjektene:

```sh
cd backend
npm install
cd ../frontend
npm install
```

## Lokal utvikling
Start backend i én terminal:

```sh
cd backend
export ADMIN_EMAIL='admin@example.test'
export ADMIN_PASSWORD='use-a-long-unique-local-secret'
npm start
```

Start frontend i en annen terminal:

```sh
cd frontend
npm run dev
```

Åpne adressen Vite viser, vanligvis `http://localhost:5173`. Frontend videresender `/api` til backend på port 3000.

Medlemsregistrering ligger på `/medlemskap`. Medlems- og administratorinnlogging ligger side om side på `/min-side`; admin-verktøy vises etter administratorinnlogging. Fra medlemsinnloggingen kan mottakere åpne gaveaktivering ved å lime inn sin personlige aktiveringslenke eller kode, og håndverkere kan gå direkte til søknadsskjemaet. Den gamle adressen `/admin` videresender til `/min-side`. Admin-legitimasjon settes kun gjennom miljøvariablene `ADMIN_EMAIL` og `ADMIN_PASSWORD`.

Dette er en lokal utviklingsversjon. Ikke bruk ekte personopplysninger. Betaling, e-postutsending og adresseoppslag er ikke integrert. Adressefeltene støtter nettleserens innebygde autofyll når nettleseren har lagret adresser; dette er ikke et adresseoppslag eller en verifisering. Se [backend/README.md](./backend/README.md) for lagring, sikkerhetsbegrensninger og API-detaljer.

## Ressurser
- Github branch organisering: https://dev.to/hardkoded/how-to-organize-your-git-branches-4dci
