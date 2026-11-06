import { setFallbackT } from '@common/i18n';
import { createI18n } from '@common/i18n/resources';

// main のテストでも、t を渡さない common の関数（解析）が使う正本の言語の t を登録しておく
//（本番では mainI18n.ts が登録する。mainI18n をモックするテストがあるので、ここでも登録する）
setFallbackT(createI18n('ja').t);
