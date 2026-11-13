// Run with: npm run test (node --test, no extra dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanBody, htmlToText, isAutoReply, parseAddresses } from "./clean.ts";

// Shape of a real sent email from Zoho: body divs, then the signature table.
const SENT_HTML = `<meta content="text/html;charset=UTF-8"><div><div style="font-family: Verdana"><div>Olá Ana,<br></div><div><br></div><div>Imagina alguém no banco de trás: "E se pagasse menos?"<br></div><div><br></div><div>Até lá, pode descobrir mais em: <a href="https://www.cartise.pt/">https://www.cartise.pt/</a><br></div><div><br></div><div>Obrigado,<br></div><div><br></div><table><tbody><tr><td><a href="https://www.cartise.pt/"><img src="logo.png" alt="Cartise"></a></td><td><div>Gonçalo Deus<br></div><div>Head of Growth · Cartise<br></div><div><a href="tel:+351912345678">+351 912 345 678</a> &nbsp;·&nbsp; <a href="mailto:goncalo@example.com">goncalo@example.com</a></div></td></tr><tr><td colspan="2">Publicidade que viaja consigo.<br></td></tr></tbody></table></div></div>`;

test("sent email: signature replaced by first name", () => {
  assert.equal(
    cleanBody(htmlToText(SENT_HTML), "Gonçalo"),
    'Olá Ana,\n\nImagina alguém no banco de trás: "E se pagasse menos?"\n\nAté lá, pode descobrir mais em: https://www.cartise.pt/\n\nObrigado,\nGonçalo',
  );
});

test("Outlook reply: quoted thread and signature cut", () => {
  const text = `Olá Gonçalo,

Obrigada pelo contacto. Podemos reunir amanhã às 10h, envia invite?

Até breve

Ana Ribeiro
Responsável de Marketing
+351910000000

From: Gonçalo Deus <goncalo@example.com>
Sent: 10 November 2026 18:55
Subject: RE: Uma ideia para a Exemplo!`;
  assert.equal(
    cleanBody(text),
    "Olá Gonçalo,\n\nObrigada pelo contacto. Podemos reunir amanhã às 10h, envia invite?\n\nAté breve",
  );
});

test("a thank-you inside the text is not a sign-off", () => {
  const text = "Olá,\n\nObrigada pelo envio do email.\nPodemos marcar uma reunião?\n\nObrigada\n\n— Marta Silva\nmarta@x.pt";
  assert.equal(cleanBody(text), "Olá,\n\nObrigada pelo envio do email.\nPodemos marcar uma reunião?\n\nObrigada");
});

test("Portuguese 'Em ... escreveu' quote marker", () => {
  const text = "Perfeito, combinado.\n\nEm qua., 11/11/2026 às 10:00, Gonçalo Deus escreveu:\n> texto antigo";
  assert.equal(cleanBody(text), "Perfeito, combinado.");
});

test("blockquotes and entities", () => {
  assert.equal(htmlToText("<p>A &amp; B &#233; &quot;ok&quot;</p><blockquote>old</blockquote>"), 'A & B é "ok"');
});

test("auto replies", () => {
  assert.ok(isAutoReply("RE: Uma ideia", "Olá, Obrigada pelo seu email. Encontro-me ausente e estarei indisponível"));
  assert.ok(isAutoReply("Automatic reply: Uma ideia", ""));
  assert.ok(!isAutoReply("RE: Uma ideia", "Podemos marcar uma reunião?"));
});

test("address parsing", () => {
  assert.deepEqual(
    parseAddresses("&quot;Ana Ribeiro&quot;&lt;Ana.Ribeiro@empresa.pt&gt;,&quot;b&quot;&lt;bruno@empresa.pt&gt;"),
    ["ana.ribeiro@empresa.pt", "bruno@empresa.pt"],
  );
  assert.deepEqual(parseAddresses("Not Provided"), []);
});
