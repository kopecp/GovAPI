# GovAPI Explorer

Polska przeglądarka publicznego **DANE.GOV.PL API v1.4**, działająca jako statyczna aplikacja w GitHub Pages.

**Strona:** https://kopecp.github.io/GovAPI/

## Pierwsza wersja

- Katalog zbiorów, zasobów, dostawców, zastosowań danych i historii zmian.
- Wyszukiwanie globalne oraz w kolekcjach, filtrowanie formatu i danych o wysokiej wartości, sortowanie i stronicowanie.
- Widoki kart, listy oraz surowej odpowiedzi JSON.
- Szczegóły rekordów, wszystkie metadane, relacje dostawca → zbiór → zasób, odnośniki do pobrania plików.
- Podgląd danych tabelarycznych udostępnionych przez API.
- Eksplorator **wszystkich 20 endpointów GET** z oficjalnej specyfikacji v1.4 pobranej 23.10.2026. Parametry są generowane ze specyfikacji; brakujące w niej definicje parametrów ścieżki są uzupełniane z szablonu URL.
- Parametry zaawansowane, operatory filtrów zagnieżdżonych, ręczny query string, język odpowiedzi, status HTTP, czas zapytania i eksport JSON.
- Zakładki w `localStorage` przeglądarki i eksport zakładek. Karty zapisanych rekordów są migawkami; otwarcie szczegółów pobiera aktualne dane.
- Responsywny interfejs, odnośniki do konkretnych widoków i zapytań, działające pod katalogiem `/GovAPI/` bez reguł przekierowań serwera.

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

`npm test` sprawdza budowanie i ograniczanie adresów API, kodowanie filtrów, obsługę wszystkich ścieżek ze specyfikacji oraz bezpieczne odnośniki. Testy jednostkowe nie wywołują zewnętrznego API.

Opcjonalny test bieżącej dostępności API:

```sh
node scripts/check-api.mjs
```

## GitHub Pages

Workflow `.github/workflows/pages.yml` uruchamia `npm ci`, testy i kompilację po push do `master`, a następnie publikuje `dist/` w GitHub Pages. W ustawieniach repozytorium źródłem publikacji musi być **GitHub Actions**. Publikację można też uruchomić ręcznie (`workflow_dispatch`).

## API i ograniczenia

- Dane są pobierane na żądanie bezpośrednio z `https://api.dane.gov.pl/1.4`. Nie ma backendu, kont użytkowników ani kluczy API. CORS dla domeny GitHub Pages został sprawdzony.
- Zakres eksploratora odpowiada wskazanej specyfikacji REST v1.4. Osobne interfejsy RDF DCAT-AP i DCAT-AP-PL widoczne w Swaggerze nie są częścią tej wersji aplikacji.
- Interfejs respektuje paginację serwera; API może ograniczyć liczbę dostępnych stron przy bardzo szerokim zapytaniu. Zawęź filtry, aby dotrzeć do dalszych danych.
- Tabele są dostępne tylko dla zasobów, dla których dostawca API udostępnia `/resources/{id}/data`. Inne pliki otwierane są u źródła. Dostępność i aktualność plików zależą od dostawcy.
- Eksport JSON dotyczy bieżącej odpowiedzi/strony, nie automatycznego pobierania całego wielomilionowego katalogu.
- Zapytania mają limit 25 sekund, można je ponowić; zmiana widoku anuluje poprzednie zapytanie. Eksplorator pozwala również anulować zapytanie ręcznie.
- Dane z API są wyświetlane jako tekst, bez wykonywania HTML. Linki do źródeł dopuszczają tylko HTTP/HTTPS, a klient API ogranicza żądania do oficjalnego hosta i wersji.
- Google Fonts dostarcza kroje DM Sans i Manrope; bez dostępu do tej usługi używany jest font systemowy.

## Aktualizacja specyfikacji

```sh
npm run sync:spec
npm test
npm run build
```

Sprawdź zmianę `public/openapi.json` przed publikacją. Jeśli liczba endpointów się zmieni, zaktualizuj test kompletności i ewentualne polskie etykiety w `src/Explorer.tsx`.

Źródła: [dokumentacja API](https://api.dane.gov.pl/doc?urls.primaryName=DANE.GOV.PL+API+v1.4), [OpenAPI](https://api.dane.gov.pl/spec/1.4), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Projekt jest niezależną przeglądarką i nie jest oficjalnym serwisem administracji publicznej. Warunki ponownego wykorzystania danych są określane przez ich dostawców i dostępne w metadanych rekordów.
