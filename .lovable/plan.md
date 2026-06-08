## Obiettivo
Disattivare il personaggio HD nel menu RPG e mostrare al suo posto il deck di Beyblade del giocatore. Creare un editor di deck dedicato al gioco (separato dai deck del sito) che usa le componenti del catalogo del sito, sbloccabili via gacha/shop, con admin panel per rarità e tipologia.

## 1. Database (nuove tabelle)

```text
rpg_component_settings        -- admin: rarità + tipologia per ogni componente
  component_id (PK, FK collection_components.id)
  rarity (text: common|rare|epic|legendary)
  bey_type (text: attack|defense|stamina|balance)
  enabled (bool)

rpg_owned_components          -- inventario componenti del giocatore
  user_id, component_id, qty, obtained_at
  PK(user_id, component_id)

rpg_game_decks                -- deck assemblati nel gioco (3 bey per deck)
  id, user_id, name, is_active

rpg_game_deck_beys            -- ogni bey nel deck
  id, deck_id, position (1-3),
  blade_id, ratchet_id, bit_id     -- FK collection_components
```

Niente cambi su `rpg_profiles`. RLS: user vede/modifica solo le proprie righe; `rpg_component_settings` è leggibile da `authenticated`, scrivibile solo da admin. Grant per `authenticated` + `service_role`.

## 2. UI: MainMenu
- Rimuovere `HDAvatar` + `CharacterEditorPanel` dal MainMenu (commentato, non eliminato — recuperabile in futuro).
- Sostituirlo con un **DeckShowcase**: mostra i 3 bey del deck attivo (immagini blade/ratchet/bit, nome, tipo calcolato, stats sommate) con un CTA "Modifica deck".

## 3. Nuovo editor: `GameDeckBuilder`
- Sostituisce l'attuale `DeckBuilder.tsx`.
- 3 slot bey × 3 componenti (Blade, Ratchet, Bit) ciascuno.
- Selettore componenti tipo `ComponentPicker` del sito, ma:
  - Esclude la categoria root "BEY COMPLETI" e figlie.
  - Mostra **solo componenti posseduti** (`rpg_owned_components.qty > 0`).
  - Mostra rarità (badge colorato) e tipo del componente.
- Per ogni bey monta, calcola in live:
  - Stats totali = somma `collection_component_stats` dei 3 componenti.
  - Tipologia bey = tipologia con peso maggiore tra i 3 componenti (admin-defined `bey_type`); pareggi → `balance`.
- Salva su `rpg_game_decks` + `rpg_game_deck_beys`. Un solo deck attivo.

## 4. Battaglia
- `BattleScene` legge il deck attivo da `rpg_game_decks` invece dei `BEY_CATALOG`/site decks.
- HP e mosse derivati dal tipo + stats sommate (formula in `data/gameDeckResolver.ts`).
- Fallback al deck catalogo se nessun deck attivo.

## 5. Shop (gioco) — sblocco componenti
- Nuova tab "Componenti" nello Shop.
- Pesca pesata per rarità (common: 50%, rare: 30%, epic: 15%, legendary: 5% — modificabile da admin in futuro).
- Costo per rarità (configurabile in costanti).
- Doppioni → `qty++` + bonus monete.

## 6. Gacha
- Trasforma `ComingSoon` Gacha in vero gacha:
  - Single pull (100 punti) e Multi 10x (900 punti).
  - Stesse pool/probabilità del pool componenti.
  - Doppione → conversione punti.

## 7. Admin Panel in-game
- Nuovo screen `AdminPanel` accessibile dal MainMenu (visibile solo se `useAdmin().isAdmin`).
- Tabella di tutti i `collection_components` (escluso "BEY COMPLETI"):
  - Colonna Rarità (select).
  - Colonna Tipo (select: attack/defense/stamina/balance).
  - Toggle Enabled.
- Salvataggio in `rpg_component_settings` (upsert).
- Bulk action: imposta default per categoria.

## 8. File touched
- **DB**: nuova migration con 4 tabelle + RLS + GRANT.
- **Created**: 
  - `src/features/rpg/data/componentsCatalog.ts` (loader + resolver tipo/stats)
  - `src/features/rpg/screens/GameDeckBuilder.tsx` (sostituisce DeckBuilder)
  - `src/features/rpg/screens/AdminPanel.tsx`
  - `src/features/rpg/components/DeckShowcase.tsx`
  - `src/features/rpg/components/RpgComponentPicker.tsx`
  - `src/features/rpg/state/gameDeckStore.ts` (hook deck attivo)
- **Edited**:
  - `RpgApp.tsx` (route admin + nuova screen deck)
  - `MainMenu.tsx` (rimuove HDAvatar/editor, mostra DeckShowcase, bottone Admin se admin)
  - `Shop.tsx` (tab Componenti)
  - `ComingSoon.tsx` → nuovo `GachaScreen.tsx`
  - `BattleScene.tsx` (usa deck di gioco)

## Note tecniche
- Le statistiche del sito (`collection_component_stats`) hanno schema flessibile (stat_name+value). Useremo direttamente quei valori come modificatori in battaglia.
- Tutto in italiano per la UI.
- Il personaggio viene solo nascosto, gli asset capelli restano in repo (non sprecati).
- Niente nuove rotte: tutto vive sotto `/beta/rpg`.
