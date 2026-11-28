import * as fs from 'node:fs';
import * as path from 'node:path';
import { GAME_CATALOG } from '../src/shared/games.ts';
import { PACK_MALAYSIAN_GAME_CATALOG, PACK_MALAYSIAN_ZH } from '../src/shared/packMalaysianCatalog.ts';
import { getLocalizedGameMeta } from '../src/lib/i18n.tsx';

function parseBaseZhSettingKeys(i18nSource: string): Map<string, number[]> {
  const result = new Map<string, number[]>();
  const lines = i18nSource.split('\n');
  const startIdx = lines.findIndex((line) => line.includes('const GAME_ZH: Record<GameId, GameTranslationZh>'));
  if (startIdx < 0) {
    throw new Error('Could not locate GAME_ZH in src/lib/i18n.tsx');
  }

  let currentId: string | null = null;
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes('PACK_MALAYSIAN_GAME_CATALOG.map')) {
      break;
    }
    const idMatch = line.match(/^\s*'([a-z0-9-]+)':\s*\{/);
    if (idMatch) {
      currentId = idMatch[1];
      continue;
    }
    if (currentId && line.includes('settingOptions:')) {
      let block = line;
      let j = i;
      while (!block.includes('}') && j + 1 < lines.length) {
        j += 1;
        block += ' ' + lines[j];
      }
      const braceOpen = block.indexOf('{');
      const braceClose = block.indexOf('}', braceOpen);
      const inner = braceOpen >= 0 && braceClose > braceOpen ? block.slice(braceOpen + 1, braceClose) : '';
      const keys = Array.from(inner.matchAll(/(\d+)\s*:/g)).map((m) => Number(m[1]));
      result.set(currentId, keys);
    }
  }

  return result;
}

function main(): void {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  if (GAME_CATALOG.length !== 200) {
    errors.push(`Expected 200 games in GAME_CATALOG, found ${GAME_CATALOG.length}`);
  }

  const i18nPath = path.resolve(process.cwd(), 'src/lib/i18n.tsx');
  const i18nSource = fs.readFileSync(i18nPath, 'utf8');
  const baseZhKeyMap = parseBaseZhSettingKeys(i18nSource);

  for (const game of GAME_CATALOG) {
    if (seenIds.has(game.id)) {
      errors.push(`[${game.id}] Duplicate game ID in GAME_CATALOG`);
    }
    seenIds.add(game.id);

    const zh = getLocalizedGameMeta(game, 'zh');

    // 1. Both EN and ZH must have exactly 4 rules
    if (game.rules.length !== 4) {
      errors.push(`[${game.id}] Expected 4 EN rules, found ${game.rules.length}`);
    }
    if (zh.rules.length !== 4) {
      errors.push(`[${game.id}] Expected 4 ZH rules, found ${zh.rules.length}`);
    }

    // 2. defaultSetting must be present in settingOptions
    const enValues = game.settingOptions.map((o) => o.value);
    if (!enValues.includes(game.defaultSetting)) {
      errors.push(
        `[${game.id}] defaultSetting (${game.defaultSetting}) is not in settingOptions [${enValues.join(', ')}]`
      );
    }

    // 3. ZH settingOptions length must match EN settingOptions length
    if (zh.settingOptions.length !== game.settingOptions.length) {
      errors.push(
        `[${game.id}] Localized ZH settingOptions length (${zh.settingOptions.length}) !== EN (${game.settingOptions.length})`
      );
    }

    // 4. Base GAME_ZH raw settingOptions key parity check
    const rawZhKeys = baseZhKeyMap.get(game.id);
    if (rawZhKeys) {
      const extraKeys = rawZhKeys.filter((k) => !enValues.includes(k));
      const missingKeys = enValues.filter((v) => !rawZhKeys.includes(v));
      if (extraKeys.length > 0 || missingKeys.length > 0) {
        errors.push(
          `[${game.id}] ZH settingOptions key mismatch — EN [${enValues.join(', ')}] vs ZH [${rawZhKeys.join(', ')}]` +
            (extraKeys.length ? ` (extra: ${extraKeys.join(', ')})` : '') +
            (missingKeys.length ? ` (missing: ${missingKeys.join(', ')})` : '')
        );
      }
    }
  }

  // 5. Malaysian pack ZH array length check
  for (const game of PACK_MALAYSIAN_GAME_CATALOG) {
    const zhEntry = PACK_MALAYSIAN_ZH[game.id as keyof typeof PACK_MALAYSIAN_ZH];
    if (!zhEntry) {
      errors.push(`[${game.id}] Missing entry in PACK_MALAYSIAN_ZH`);
    } else if (zhEntry.settingOptions.length !== game.settingOptions.length) {
      errors.push(
        `[${game.id}] PACK_MALAYSIAN_ZH settingOptions length (${zhEntry.settingOptions.length}) !== EN (${game.settingOptions.length})`
      );
    }
  }

  console.log(
    `Catalog Validation: checked ${GAME_CATALOG.length} games (${baseZhKeyMap.size} base ZH key sets, ${PACK_MALAYSIAN_GAME_CATALOG.length} Malaysian ZH entries)`
  );

  if (errors.length > 0) {
    console.error(`FAILED with ${errors.length} issue(s):`);
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log('PASSED: All 200 games passed EN/ZH rules count, setting parity, and defaultSetting checks.');
}

main();
