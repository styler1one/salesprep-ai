import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, locales, type Locale } from './config';

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming locale is supported
  const validLocale = locales.includes(locale as Locale) ? locale : defaultLocale;
  
  return {
    messages: (await import(`../messages/${validLocale}.json`)).default,
  };
});

