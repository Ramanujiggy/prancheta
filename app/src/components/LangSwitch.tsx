// EN / PT: the app's language. It starts from the phone's language and the
// coach's pick is kept on this device.

import { setLang, t, useLang, type Lang } from '../lib/i18n.ts';

const LANGS: [Lang, string, string][] = [
  ['en', 'EN', 'en'],
  ['pt', 'PT', 'pt-BR'],
];

export function LangSwitch() {
  const lang = useLang();
  return (
    <div className="lang-switch" role="group" aria-label={t('language')}>
      {LANGS.map(([code, label, htmlLang]) => (
        <button key={code} type="button" lang={htmlLang} aria-pressed={lang === code} onClick={() => setLang(code)}>
          {label}
        </button>
      ))}
    </div>
  );
}
