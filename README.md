# GovAPI Explorer

Polska przeglądarka publicznych **DANE.GOV.PL API v1.4** i **ELI API Sejmu**, działająca jako statyczna aplikacja w GitHub Pages. Przełącznik na górze zmienia źródło danych i nawigację.

**Strona:** https://kopecp.github.io/GovAPI/

## DANE.GOV.PL

- Katalog zbiorów, zasobów, dostawców, zastosowań danych i historii zmian.
- Wyszukiwanie globalne oraz w kolekcjach, filtrowanie formatu i danych o wysokiej wartości, sortowanie i stronicowanie.
- Widoki kart, listy oraz surowej odpowiedzi JSON.
- Szczegóły rekordów, wszystkie metadane, relacje dostawca → zbiór → zasób, odnośniki do pobrania plików.
- Podgląd danych tabelarycznych udostępnionych przez API.
- Eksplorator **wszystkich 20 endpointów GET** z oficjalnej specyfikacji v1.4 pobranej 23.10.2026. Parametry są generowane ze specyfikacji; brakujące w niej definicje parametrów ścieżki są uzupełniane z szablonu URL.
- Parametry zaawansowane, operatory filtrów zagnieżdżonych, ręczny query string, język odpowiedzi, status HTTP, czas zapytania i eksport JSON.
- Zakładki w `localStorage` przeglądarki i eksport zakładek. Karty zapisanych rekordów są migawkami; otwarcie szczegółów pobiera aktualne dane.
- Responsywny interfejs, odnośniki do konkretnych widoków i zapytań, działające pod katalogiem `/GovAPI/` bez reguł przekierowań serwera.

## ELI — akty prawne

- Dziennik Ustaw i Monitor Polski, roczniki oraz historyczne zeszyty pobierane z API.
- Wyszukiwanie tytułów; filtry dziennika, roku, typu, obowiązywania, słów kluczowych, pozycji, zeszytu i dat wydania, publikacji oraz wejścia w życie. Sortowanie i paginacja serwera (`limit` / `offset`).
- Bezpośrednie otwieranie aktu przez identyfikator ELI, adres publikacyjny ISAP lub link `eli.gov.pl`. Pełny identyfikator zachowuje zera wiodące rozróżniające niektóre historyczne akty MP.
- Karty, lista, JSON, metadane, odnośniki do wersji PDF/HTML, tekstowy podgląd HTML, struktura aktu i nawigacja po powiązanych aktach.
- Słowniki typów, słów kluczowych, instytucji, statusów i rodzajów powiązań. Typy i słowa kluczowe prowadzą do wyszukiwarki aktów.
- Lista zmian metadanych od wskazanego czasu oraz osobne zakładki ELI (`govapi:eli:saved:v1`) z eksportem JSON.
- Eksplorator **29 endpointów GET**, generowany z oficjalnego OpenAPI pobranego 24.10.2026. Parametry ścieżki i zapytania, surowy query string, walidacja wymaganych pól, status HTTP, czas, anulowanie, eksport odpowiedzi, odczyt fragmentów HTML i linki do plików.
- Trasy `#/eli-acts`, `#/eli-journals`, `#/eli-dictionaries`, `#/eli-changes`, `#/eli-act?id=DU%2F1994%2F414`, `#/eli-api`, `#/eli-saved`. Dotychczasowe trasy DANE.GOV.PL pozostają dostępne.

## Uruchomienie lokalne

Wymagany Node.js 24 i npm.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

`npm test` sprawdza budowanie i ograniczanie adresów obu API, kodowanie filtrów, obsługę wszystkich ścieżek ze specyfikacji, historyczne identyfikatory ELI, paginację, zakładki oraz odpowiedzi i anulowanie żądań. Testy jednostkowe nie wywołują zewnętrznego API.

Opcjonalny test bieżącej dostępności API:

```sh
node scripts/check-api.mjs
node scripts/check-eli.mjs
```

## GitHub Pages

Workflow `.github/workflows/pages.yml` uruchamia `npm ci`, testy i kompilację po push do `master`, a następnie publikuje `dist/` w GitHub Pages. W ustawieniach repozytorium źródłem publikacji musi być **GitHub Actions**. Publikację można też uruchomić ręcznie (`workflow_dispatch`).

## API i ograniczenia

- Dane są pobierane na żądanie bezpośrednio z `https://api.dane.gov.pl/1.4`. Nie ma backendu, kont użytkowników ani kluczy API. CORS dla domeny GitHub Pages został sprawdzony.
- Akty są pobierane bezpośrednio z `https://api.sejm.gov.pl/eli`. CORS dla `https://kopecp.github.io` również został sprawdzony. Dostępne dzienniki wynikają z odpowiedzi `/acts`; aplikacja nie agreguje osobnych API wszystkich wojewódzkich dzienników widocznych w portalu ELI.
- Statusy i daty obowiązywania są prezentowane zgodnie z metadanymi ELI. Lista zmian dotyczy aktualizacji danych API. Podgląd HTML jest przekształcany w tekst bez wykonywania kodu; oryginalne formatowanie tabel i przypisów pozostaje dostępne w linkowanych plikach źródłowych.
- Zakres eksploratora odpowiada wskazanej specyfikacji REST v1.4. Osobne interfejsy RDF DCAT-AP i DCAT-AP-PL widoczne w Swaggerze nie są częścią tej wersji aplikacji.
- Interfejs respektuje paginację serwera; API może ograniczyć liczbę dostępnych stron przy bardzo szerokim zapytaniu. Zawęź filtry, aby dotrzeć do dalszych danych.
- Tabele są dostępne tylko dla zasobów, dla których dostawca API udostępnia `/resources/{id}/data`. Inne pliki otwierane są u źródła. Dostępność i aktualność plików zależą od dostawcy.
- Eksport JSON dotyczy bieżącej odpowiedzi/strony, nie automatycznego pobierania całego wielomilionowego katalogu.
- Zapytania mają limit 25 sekund, można je ponowić; zmiana widoku anuluje poprzednie zapytanie. Eksplorator pozwala również anulować zapytanie ręcznie.
- Dane z API są wyświetlane jako tekst, bez wykonywania HTML. Linki do źródeł dopuszczają tylko HTTP/HTTPS, a klienci API ograniczają żądania do oficjalnych hostów i przestrzeni ścieżek.
- Google Fonts dostarcza kroje DM Sans i Manrope; bez dostępu do tej usługi używany jest font systemowy.

## Aktualizacja specyfikacji

```sh
npm run sync:spec
npm run sync:spec -- --eli
npm test
npm run build
```

Sprawdź zmianę `public/openapi.json` przed publikacją. Jeśli liczba endpointów się zmieni, zaktualizuj test kompletności i ewentualne polskie etykiety w `src/Explorer.tsx`.

Opcja `--eli` aktualizuje wyłącznie `public/eli-openapi.json` (nagłówek `Accept: application/json` jest wymagany, ponieważ domyślnym formatem źródła jest YAML). Etykiety ELI i budowanie adresów znajdują się w `src/eli-api.ts`, a test kompletności w `tests/eli.test.ts`.

Źródła: [dokumentacja API](https://api.dane.gov.pl/doc?urls.primaryName=DANE.GOV.PL+API+v1.4), [OpenAPI](https://api.dane.gov.pl/spec/1.4), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

ELI: [portal](https://eli.gov.pl/), [dokumentacja API](https://api.sejm.gov.pl/eli_pl.html), [OpenAPI](https://api.sejm.gov.pl/eli/openapi/).

Projekt jest niezależną przeglądarką i nie jest oficjalnym serwisem administracji publicznej. Warunki ponownego wykorzystania danych są określane przez ich dostawców i dostępne w metadanych rekordów.
