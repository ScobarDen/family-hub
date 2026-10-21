import { Temporal } from "temporal-polyfill";

const startOfImage = 0xff_d8;
const app1Marker = 0xff_e1;
const startOfScan = 0xff_da;
const exifHeader = "Exif\0\0";
const littleEndian = 0x49_49;
const exifIfdTag = 0x87_69;
const dateTimeOriginalTag = 0x90_03;
const dateTimeTag = 0x01_32;

// Byte layout of a JPEG segment and of a TIFF IFD entry: tag, type, count, value or offset.
const layout = {
  markerLength: 2,
  segmentHeader: 4,
  ifdCount: 2,
  entrySize: 12,
  entryCount: 4,
  entryValue: 8,
  firstIfdOffset: 4,
  tiffHeader: 8,
} as const;

const exifDatePattern = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/u;

type Tiff = { view: DataView; start: number; isLittle: boolean };

function uint16(tiff: Tiff, offset: number): number {
  return tiff.view.getUint16(tiff.start + offset, tiff.isLittle);
}

function uint32(tiff: Tiff, offset: number): number {
  return tiff.view.getUint32(tiff.start + offset, tiff.isLittle);
}

function asciiAt(view: DataView, { offset, length }: { offset: number; length: number }): string {
  return new TextDecoder("ascii").decode(
    new Uint8Array(view.buffer, view.byteOffset + offset, length),
  );
}

function entryOf(tiff: Tiff, { ifd, tag }: { ifd: number; tag: number }): number | undefined {
  const count = uint16(tiff, ifd);

  for (let index = 0; index < count; index += 1) {
    const entry = ifd + layout.ifdCount + index * layout.entrySize;

    if (uint16(tiff, entry) === tag) {
      return entry;
    }
  }

  return undefined;
}

function textAt(tiff: Tiff, entry: number): string {
  return asciiAt(tiff.view, {
    offset: tiff.start + uint32(tiff, entry + layout.entryValue),
    length: uint32(tiff, entry + layout.entryCount),
  });
}

function dateOf(tiff: Tiff): string | undefined {
  const ifd0 = uint32(tiff, layout.firstIfdOffset);
  const exifPointer = entryOf(tiff, { ifd: ifd0, tag: exifIfdTag });
  const exifIfd =
    exifPointer === undefined ? undefined : uint32(tiff, exifPointer + layout.entryValue);
  const original =
    exifIfd === undefined ? undefined : entryOf(tiff, { ifd: exifIfd, tag: dateTimeOriginalTag });
  const entry = original ?? entryOf(tiff, { ifd: ifd0, tag: dateTimeTag });

  return entry === undefined ? undefined : textAt(tiff, entry);
}

function tiffIn(view: DataView): Tiff | undefined {
  let offset = layout.markerLength;

  while (offset + layout.segmentHeader <= view.byteLength) {
    const marker = view.getUint16(offset);
    const header = offset + layout.segmentHeader;

    if (marker === startOfScan) {
      return undefined;
    }

    if (
      marker === app1Marker &&
      asciiAt(view, { offset: header, length: exifHeader.length }) === exifHeader
    ) {
      const start = header + exifHeader.length;

      return { view, start, isLittle: view.getUint16(start) === littleEndian };
    }

    offset += layout.markerLength + view.getUint16(offset + layout.markerLength);
  }

  return undefined;
}

function momentOf(text: string, timeZone: string): number | null {
  const match = exifDatePattern.exec(text);

  if (match === null) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;

  return Temporal.PlainDateTime.from(
    `${year}-${month}-${day}T${hour}:${minute}:${second}`,
  ).toZonedDateTime(timeZone).epochMilliseconds;
}

// A camera writes the moment a photo was taken as its own wall clock, with no zone.
export function readTakenAt(bytes: ArrayBuffer, timeZone: string): number | null {
  try {
    const view = new DataView(bytes);

    if (view.byteLength < layout.tiffHeader || view.getUint16(0) !== startOfImage) {
      return null;
    }

    const tiff = tiffIn(view);
    const text = tiff === undefined ? undefined : dateOf(tiff);

    return text === undefined ? null : momentOf(text, timeZone);
  } catch {
    return null;
  }
}
