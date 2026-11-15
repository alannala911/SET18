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

Medlemsregistrering ligger på `/medlemskap`. Medlems- og administratorinnlogging ligger side om side på `/min-side`; admin-verktøy vises etter administratorinnlogging. Fra medlemsinnloggingen kan mottakere åpne gaveaktivering, mindreårige brukere registrere innlogging, og godkjente husflidshåndverkere opprette passord ved å lime inn en personlig aktiveringslenke eller kode. Håndverkersøknaden sendes fortsatt fra medlemskapsskjemaet; etter godkjenning deler administrator lenken privat med søkeren. Den gamle adressen `/admin` videresender til `/min-side`. Admin-legitimasjon settes kun gjennom miljøvariablene `ADMIN_EMAIL` og `ADMIN_PASSWORD`.

Admin kan aktivere og konfigurere standardskjemaene, legge til egne felt og innholdsbokser i dem, og lage helt nye skjemaer fra blankt. Innsendinger fra egendefinerte skjemaer lagres som søknader for administratorbehandling; de oppretter ikke medlemskonto automatisk.

Egendefinerte skjemaer kan aktiveres og deaktiveres under «Aktive skjemaer». De må ha minst ett inndatafelt før de kan aktiveres.

Søkesiden viser treff i offentlig sideinnhold, publiserte kurs, aktiviteter og nyheter samt tilgjengelig kontakt- og medlemskapsinformasjon. Treffene grupperes etter side, og søketeksten markeres. Utkast, arkivert innhold og administrasjonsdata tas ikke med, heller ikke når en administrator søker.
Tekst på statiske sider vedlikeholdes i søkeindeksen og må oppdateres der når sideteksten endres.

I skjemaet for mindreårige brukes samme innstilling for overskrift og hjelpetekst for alle foreldre. Foreldernummer legges til automatisk.

Administratorer kan også legge til, redigere og forhåndsvise nyheter fra nyhetssiden. Nyheter kan lagres som utkast, publiseres eller arkiveres, og publiserte nyheter vises for besøkende.

Besøkende kan legge publiserte kurs og aktivitetsbilletter i handlekurven, som lagres i nettleseren. Aktivitetsbilletter kan legges til uten innlogging, men medlemsinnlogging kreves før bestilling. «Bestill» åpner betalingssiden, men betaling, plassreservasjon og bekreftet bestilling er ikke tilgjengelig ennå.
Aktiviteter uten billettype og pris kan legges i handlekurven, men kan ikke bestilles før billettype og pris er opprettet og en billett er valgt.

Publiserte kurs og aktiviteter arkiveres automatisk dagen etter datoen deres, etter norsk tid. Arkivene vises bare for administratorer; tidligere aktivitetsbestillinger beholdes. For å publisere et arkivert kurs eller en aktivitet på nytt må administrator velge dagens dato eller en senere dato og publisert status.
På kurs- og aktivitetssidene kan man filtrere etter tidsperiode, angi et eget datointervall under «Avansert valg» og sortere resultatene. Varighet for kurs beregnes bare når tiden er angitt som et tydelig tidsrom på samme dag.

På kontaktsiden kan administratorer redigere felles kontaktinformasjon og kontaktpersonene. «Send oss en melding» lagrer henvendelser i en administratorinnboks på kontaktsiden. Meldingen sendes ikke automatisk på e-post; administratoren kan svare ved å åpne avsenderens e-postlenke.

Dette er en lokal utviklingsversjon. Ikke bruk ekte personopplysninger. Betaling, automatisk e-postutsending fra kontaktskjemaet og adresseoppslag er ikke integrert. Adressefeltene støtter nettleserens innebygde autofyll når nettleseren har lagret adresser; dette er ikke et adresseoppslag eller en verifisering. Se [backend/README.md](./backend/README.md) for lagring, sikkerhetsbegrensninger og API-detaljer.

## Ressurser
- Github branch organisering: https://dev.to/hardkoded/how-to-organize-your-git-branches-4dci
