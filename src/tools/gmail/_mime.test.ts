// Regressionstest fuer die Header-Kodierung beim MIME-Bau.
//
// VORFALL 2026-09-30. Ein Gmail-Draft an einen Kunden trug im Betreff
// "Re: KÃ¼ndigung ... EingangsbestÃ¤tigung ..." statt "Re: Kündigung ... Eingangsbestätigung ...".
// Der Body war korrekt, weil er ueber `Content-Type: ...; charset=UTF-8` deklariert wird.
// Der Subject-Header dagegen wurde roh interpoliert (`Subject: ${subject}`), und
// `encodeMimeForGmail` schreibt die gesamte Nachricht als UTF-8-Bytes. Header sind nach
// RFC 5322 aber auf 7-bit-ASCII beschraenkt -- Clients lesen die rohen Bytes als Latin-1,
// aus 0xC3 0xBC ("ü") wird "Ã¼".
//
// Betroffen war nicht nur createDraft: sendEmail und forwardEmail bauen ueber dieselbe
// Funktion. Die Klasse ist "jeder Header-Wert mit Nicht-ASCII", also auch Anzeigenamen
// in From/To/Cc und Dateinamen von Anhaengen.

import { describe, it, expect } from 'vitest';
import { buildMimeMessage, encodeHeaderValue } from './_mime.js';

/** Dekodiert RFC-2047-encoded-words zurueck, damit der Test den Roundtrip prueft. */
function decodeEncodedWords(header: string): string {
  return header
    .replace(/\?=\r\n\s=\?/g, '?==?') // gefaltete Folgewoerter wieder zusammenziehen
    .replace(/=\?UTF-8\?B\?([^?]*)\?=/g, (_m, b64) => Buffer.from(b64, 'base64').toString('utf-8'));
}

function headerLine(mime: string, name: string): string {
  const m = mime.match(new RegExp(`^${name}: (.*(?:\\r\\n[ \\t].*)*)$`, 'm'));
  return m ? m[1] : '';
}

const BASIS = {
  to: 'karsten.puck@example.com',
  subject: 'Re: Kündigung unseres Partnervertrages - Eingangsbestätigung und Vertragsende',
  bodyText: 'Hallo Karsten,\r\n\r\ndanke für die klare Nachricht. Grüße, Maßnahmen, Löhestraße.',
};

describe('encodeHeaderValue', () => {
  it('laesst reines ASCII unveraendert (kein unnoetiges Kodieren)', () => {
    expect(encodeHeaderValue('Re: Partnervertrag - Vertragsende 11.12.2026')).toBe(
      'Re: Partnervertrag - Vertragsende 11.12.2026'
    );
  });

  it('kodiert Umlaute als RFC-2047-encoded-word', () => {
    const out = encodeHeaderValue('Kündigung');
    expect(out).toMatch(/^=\?UTF-8\?B\?/);
    expect(out).not.toContain('ü');
    expect(decodeEncodedWords(out)).toBe('Kündigung');
  });

  it('haelt jedes encoded-word unter der RFC-2047-Grenze von 75 Zeichen', () => {
    const out = encodeHeaderValue(BASIS.subject);
    for (const wort of out.split(/\r\n\s/)) {
      expect(wort.length).toBeLessThanOrEqual(75);
    }
  });

  it('zerschneidet kein Mehrbyte-Zeichen beim Falten', () => {
    // 60 Umlaute erzwingen mehrere encoded-words; ein Schnitt mitten durch ein
    // 2-Byte-Zeichen wuerde beim Dekodieren ein Ersetzungszeichen liefern.
    const lang = 'üöäß'.repeat(15);
    const zurueck = decodeEncodedWords(encodeHeaderValue(lang));
    expect(zurueck).toBe(lang);
    expect(zurueck).not.toContain('�');
  });
});

describe('buildMimeMessage — Header', () => {
  it('schreibt KEINE rohen Nicht-ASCII-Bytes in den Subject-Header (Vorfall 2026-09-30)', () => {
    const mime = buildMimeMessage(BASIS);
    const subject = headerLine(mime, 'Subject');
    expect(subject).not.toContain('ü');
    expect(subject).not.toContain('ä');
    expect(decodeEncodedWords(subject)).toBe(BASIS.subject);
  });

  it('kodiert den Anzeigenamen, laesst die Adresse aber unangetastet', () => {
    const mime = buildMimeMessage({ ...BASIS, to: 'Jürgen Groß <juergen@example.com>' });
    const to = headerLine(mime, 'To');
    expect(to).toContain('<juergen@example.com>');
    expect(to).not.toContain('Jürgen');
    expect(decodeEncodedWords(to)).toBe('Jürgen Groß <juergen@example.com>');
  });

  it('laesst eine reine ASCII-Adressliste byte-identisch', () => {
    const mime = buildMimeMessage({ ...BASIS, cc: 'a@example.com, b@example.com' });
    expect(headerLine(mime, 'Cc')).toBe('a@example.com, b@example.com');
  });

  it('kodiert Dateinamen von Anhaengen', () => {
    const mime = buildMimeMessage({
      ...BASIS,
      attachments: [
        { filename: 'Kündigung Schwarz.pdf', mimeType: 'application/pdf', dataBase64Url: 'AAAA' },
      ],
    });
    const anhang = mime.split('--bnd_')[2] ?? '';
    expect(anhang).not.toContain('Kündigung');
    expect(decodeEncodedWords(anhang)).toContain('Kündigung Schwarz.pdf');
  });

  it('laesst den Body weiterhin als UTF-8 durch (der Pfad war korrekt, Regressionsschutz)', () => {
    const mime = buildMimeMessage(BASIS);
    expect(mime).toContain('charset=UTF-8');
    expect(mime).toContain('danke für die klare Nachricht');
    expect(mime).toContain('Grüße, Maßnahmen, Löhestraße');
  });
});
