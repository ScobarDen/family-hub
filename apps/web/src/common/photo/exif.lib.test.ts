import { describe, expect, test } from "vite-plus/test";

import { readTakenAt } from "./exif.lib.ts";

type Entry = { tag: number; text: string };

// Builds a JPEG whose only APP1 segment is an Exif TIFF with one IFD0 entry and an Exif IFD.
function jpegWith({ ifd0, exif, isLittle }: { ifd0: Entry[]; exif: Entry[]; isLittle: boolean }) {
  const tiff = new DataView(new ArrayBuffer(512));
  let free = 200;

  function writeIfd(
    at: number,
    entries: Array<{ tag: number; type: number; count: number; value: number }>,
  ) {
    tiff.setUint16(at, entries.length, isLittle);

    for (const [index, { tag, type, count, value }] of entries.entries()) {
      const entry = at + 2 + index * 12;

      tiff.setUint16(entry, tag, isLittle);
      tiff.setUint16(entry + 2, type, isLittle);
      tiff.setUint32(entry + 4, count, isLittle);
      tiff.setUint32(entry + 8, value, isLittle);
    }
  }

  function text(entry: Entry) {
    const bytes = new TextEncoder().encode(`${entry.text}\0`);
    const at = free;

    for (const [index, byte] of bytes.entries()) {
      tiff.setUint8(at + index, byte);
    }

    free += bytes.length;

    return { tag: entry.tag, type: 2, count: bytes.length, value: at };
  }

  tiff.setUint16(0, isLittle ? 0x49_49 : 0x4d_4d);
  tiff.setUint16(2, 42, isLittle);
  tiff.setUint32(4, 8, isLittle);
  writeIfd(8, [...ifd0.map(text), { tag: 0x87_69, type: 4, count: 1, value: 100 }]);
  writeIfd(100, exif.map(text));

  const header = new TextEncoder().encode("Exif\0\0");
  const length = 2 + header.length + tiff.byteLength;
  const jpeg = new Uint8Array(4 + 2 + length);
  const view = new DataView(jpeg.buffer);

  view.setUint16(0, 0xff_d8);
  view.setUint16(2, 0xff_e1);
  view.setUint16(4, length);
  jpeg.set(header, 6);
  jpeg.set(new Uint8Array(tiff.buffer), 6 + header.length);

  return jpeg.buffer;
}

describe("the moment a photo was taken", () => {
  test.each([true, false])(
    "comes from DateTimeOriginal on the camera's clock (little-endian: %s)",
    (isLittle) => {
      const jpeg = jpegWith({
        ifd0: [{ tag: 0x01_32, text: "2026:08:02 10:00:00" }],
        exif: [{ tag: 0x90_03, text: "2026:08:01 15:30:00" }],
        isLittle,
      });

      expect(readTakenAt(jpeg, "Europe/Moscow")).toBe(Date.parse("2026-08-01T12:30:00Z"));
    },
  );

  test("falls back to the file's DateTime", () => {
    const jpeg = jpegWith({
      ifd0: [{ tag: 0x01_32, text: "2026:08:02 10:00:00" }],
      exif: [],
      isLittle: true,
    });

    expect(readTakenAt(jpeg, "UTC")).toBe(Date.parse("2026-08-02T10:00:00Z"));
  });

  test("is unknown for a picture without Exif or not a JPEG at all", () => {
    expect(readTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer, "UTC")).toBeNull();
    expect(readTakenAt(new TextEncoder().encode("GIF89a, not a photo").buffer, "UTC")).toBeNull();
  });
});
