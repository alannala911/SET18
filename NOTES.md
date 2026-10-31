# SET18 prosjektnotater

## Status
- Det finnes allerede en frontend i `frontend/`.
- Det er også opprettet en separat backend i `backend/`.
- Backend er designet som et eget prosjekt uten å endre eksisterende frontend-filer.

## Viktige regler
- Ingen endringer skal gjøres i frontend uten eksplisitt tillatelse.
- Backend og frontend skal holdes separat.
- Hvis vi senere vil publisere nettsiden, må backend deployes separat og frontend deployes separat.
- Dette er lokalt utviklingsarbeid, ikke offentlig nettside ennå.

## Backend-plan
- Backend skal håndtere innhold som aktiviteter, kurs, nyheter og lokallag.
- Backend skal kunne håndtere kontaktforespørsler.
- Backend skal være strukturert slik at det senere kan utvides med admin-funksjonalitet og medlemsregistrering.

## Medlemsregistrering
Administrator skal kunne konfigurere hvordan innmeldingsskjemaet ser ut, blant annet hvilke medlemskapstyper som er aktive, hvilke felt som vises og hvilke felt som er obligatoriske. Skjemaet skal skille mellom vanlig medlemskap (18 år og eldre) og medlemskap for mindreårige (under 18 år).

### Vanlig medlemskap (18 år og eldre)
- Fødselsdato: brukes til å kontrollere at kjøperen er 18 år eller eldre.
- Personlig informasjon:
  - Fornavn
  - Mellomnavn (valgfritt)
  - Etternavn
  - Kjønn: Mann, Kvinne eller Annet
  - E-post: kontroller at adressen ikke allerede er knyttet til et registrert telefonnummer.
  - Telefonnummer: kontroller at nummeret ikke allerede er registrert på et medlemskap.
- Passord:
  - Passord
  - Bekreft passord: må samsvare med passordet.
- Adresse:
  - Gateadresse skrives inn og må velges fra adresseforslag som viser adresse, postnummer og poststed.
  - Postnummer og poststed vises i egne felt etter at et adresseforslag er valgt. Feltene kan ikke redigeres direkte.
- Lokallag:
  - Brukeren velger en tilgjengelig region.
  - Brukeren velger et tilgjengelig lokallag i den valgte regionen.

### Medlemskap for mindreårige (under 18 år)
- Forelders informasjon:
  - Fornavn
  - Mellomnavn (valgfritt)
  - Etternavn
  - Kjønn: Mann, Kvinne eller Annet
  - E-post
  - Telefonnummer
  - Skjemaet skal kunne legge til en forelder til med de samme informasjonsfeltene.
- Barnets informasjon:
  - Fornavn
  - Mellomnavn (valgfritt)
  - Etternavn
  - Kjønn: Mann, Kvinne eller Annet
  - E-post: kontroller at adressen ikke allerede er knyttet til et registrert telefonnummer.
  - Telefonnummer: kontroller at nummeret ikke allerede er registrert på et medlemskap.
- Passord:
  - Passord
  - Bekreft passord: må samsvare med passordet.
- Adresse:
  - Gateadresse skrives inn og må velges fra adresseforslag som viser adresse, postnummer og poststed.
  - Postnummer og poststed vises i egne felt etter at et adresseforslag er valgt. Feltene kan ikke redigeres direkte.
- Lokallag:
  - Brukeren velger en tilgjengelig region.
  - Brukeren velger et tilgjengelig lokallag i den valgte regionen.
- Samtykke fra foresatt må bekreftes.

### Medlemskap gitt i gave
Kjøperen skal kunne kjøpe et medlemskap på vegne av en mottaker. Kjøperen må være 18 år eller eldre.

- Kjøperens fødselsdato brukes til å kontrollere at kjøperen er 18 år eller eldre.
- Kjøperens personlige informasjon:
  - Fornavn
  - Mellomnavn (valgfritt)
  - Etternavn
  - Kjønn: Mann, Kvinne eller Annet
  - E-post
  - Telefonnummer
- Kjøperens adresse:
  - Gateadresse skrives inn og må velges fra adresseforslag som viser adresse, postnummer og poststed.
  - Postnummer og poststed vises i egne felt etter at et adresseforslag er valgt. Feltene kan ikke redigeres direkte.
- Mottakerens fødselsdato brukes til å kontrollere mottakerens alder.
- Mottakerens personlige informasjon:
  - Fornavn
  - Mellomnavn (valgfritt)
  - Etternavn
  - Kjønn: Mann, Kvinne eller Annet
  - E-post: kontroller at adressen ikke allerede er knyttet til et registrert telefonnummer.
  - Telefonnummer: kontroller at nummeret ikke allerede er registrert på et medlemskap.
- Mottakerens adresse:
  - Gateadresse skrives inn og må velges fra adresseforslag som viser adresse, postnummer og poststed.
  - Postnummer og poststed vises i egne felt etter at et adresseforslag er valgt. Feltene kan ikke redigeres direkte.
- Kjøperen kan velge region og lokallag for mottakeren ved kjøpet, men dette er valgfritt.
- Kjøperen velger ikke passord for mottakeren.
- Etter kjøpet skal mottakeren kunne åpne «Mottatt medlemskap? Trykk her» og opprette passord. Hvis region og lokallag ikke allerede er valgt, skal mottakeren kunne velge dette under aktiveringen.

### Søknad om medlemskap som husflidshåndverker
En næringsdrivende innen husflid og håndverk skal kunne søke om medlemskap som husflidshåndverker, uavhengig av om søkeren allerede er medlem.

- Bedriftsinformasjon:
  - Bedriftsnavn
  - Organisasjonsnummer
  - Adresse: gateadresse skrives inn og må velges fra adresseforslag som viser adresse, postnummer og poststed. Postnummer og poststed vises i egne felt etter at et forslag er valgt, og kan ikke redigeres direkte.
  - Telefon
  - E-post
  - Hjemmeside (valgfritt)
  - Bedriften må ha minst én ansatt med svennebrev, tilsvarende utdanning eller høyere håndverksutdanning.
- Søkerens personinformasjon:
  - Fornavn
  - Mellomnavn (valgfritt)
  - Etternavn
  - Kjønn: Mann, Kvinne eller Annet
  - E-post: kontroller at adressen ikke allerede er knyttet til et registrert telefonnummer.
  - Telefonnummer: kontroller at nummeret ikke allerede er registrert på et medlemskap.
  - Fødselsdato: kontroller at søkeren er 18 år eller eldre.
  - Adresse: gateadresse må velges fra adresseforslag som viser adresse, postnummer og poststed. Postnummer og poststed vises i egne felt etter at et forslag er valgt, og kan ikke redigeres direkte.
- Håndverkstype velges fra en liste:
  - Tekstil
  - Skinn og lær
  - Tre
  - Kurvmaker
  - Metall
  - Knivmaker
  - Keramikk
  - Smykker
  - Glass
  - Duodji
  - Rose- og dekormaling
  - Annet
- Søker velger én av følgende opptaksmetoder:
  - Automatisk opptak med svennebrev/fagbrev: last opp svennebrev eller fagbrev.
  - Juryert opptak med egenportefølje: last opp bilder av et representativt utvalg produkter til juryering. Søkeren skal også sende inn 3–5 produkter til juryering.
    - Administrator skal kunne legge inn og endre informasjon om hvor produktene skal sendes.
- Når juryert opptak er valgt, vises juryeringsfeltene:
  - Innledning: «Opptak med juryering skjer ved at du fyller ut skjema under og sender oss et representativt utvalg av produkter som kan vise din faglige kompetanse.»
  - Relevant utdanning / realkompetanse
  - Relevant praksis
  - Deltagelse på nasjonale juryerte stillinger
  - Mottatt designpris eller lignende på nasjonalt/regionalt nivå
  - Informasjon om innsendte produkter til juryering:
    - Materialer
    - Form, farge og dekor
    - Fremstillingsteknikk
    - Bruksområde
    - Originalitet
    - Hva vedlagte fotografier viser
  - Disse feltene skal være store tekstfelt med hjelpetekst som forsvinner når søkeren begynner å skrive.
- Husflidslag:
  - Informasjonstekst: «Som husflidshåndverker kan du være medlem i ditt lokale husflidslag uten ekstra kostnader.»
  - Søkeren kan velge en tilgjengelig region og et lokallag i regionen.
- Søkeren må bekrefte at medlemskriteriene for Norske Husflidshåndverkere i Norges Husflidslag er forstått.

### Felles regler for adresse
- Hvis brukeren endrer gateadressen etter å ha valgt et forslag, skal postnummer og poststed fjernes.
- Brukeren må velge et nytt adresseforslag for å fylle inn postnummer og poststed igjen.

### Admin-konfigurasjon
Administrator skal kunne styre:
- hvilke medlemskapstyper som er aktive
- hvilke felt som vises og hvilke som er obligatoriske
- hvilke regioner og lokallag som er tilgjengelige
- hvilke lokallag som tilhører hver region
- informasjon om hvor produkter skal sendes ved juryert opptak som husflidshåndverker

### Avklaringer
- Medlemskapstypene er definert ut fra alder, men fødselsdato er bare oppført for vanlig medlemskap. Det må avklares hvordan alderen til barnet skal kontrolleres for mindreårig medlemskap.
- E-postregelen må presiseres: beskrivelsen sier at e-post ikke skal ligge under et registrert telefonnummer.

## Hovedprinsipp
- Frontend er for brukergrensesnittet.
- Backend er for data, validering og admin-logikk.
- Ingen frontend-endringer uten eksplisitt godkjenning.

## Neste steg
Når vi fortsetter, bør vi bestemme om vi vil:
1. lage en mer detaljert backend-datamodell,
2. lage en admin-konfigurasjon for medlemskapstyper,
3. eller gå videre med en konkret frontend-backend-integrasjon.

## Oppsummering
Vi har nå avklart at:
- backend er separat fra frontend
- prosjektet ikke er publisert eller globalt tilgjengelig ennå
- det er ikke en lokal begrensning som gjør det kun tilgjengelig for én bruker
- det er kun utviklingsstatus og ikke produksjonsutgivelse
