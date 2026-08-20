# Bundled asset licenses

Vokhanhbel bundles third-party fonts and icon artwork. The built application serves everything from
its own hashed assets or inline markup; it does not contact a font or icon CDN at runtime.

## Fonts

Baloo 2 and Be Vietnam Pro are sourced from Fontsource and served as WOFF2 files.

- Baloo 2: Copyright 2019 The Baloo 2 Project Authors. See `OFL-Baloo-2.txt`.
- Be Vietnam Pro: Copyright 2021 The Be Vietnam Pro Project Authors. See
  `OFL-Be-Vietnam-Pro.txt`.

Both font families are distributed under the SIL Open Font License 1.1. The copied license files
include each upstream package's complete copyright notice and license text.

## Collection icons

The Collection icons in `src/components/CollectionIcon.tsx` are inlined SVG rather than files, so
their notices live here.

- The default open-book glyph is the `book-open` icon from [Lucide](https://lucide.dev), used under
  the ISC license. See `ISC-Lucide.txt`, which is Lucide's complete upstream license file: it also
  carries the MIT notice covering the icons Lucide inherited from Feather.
- The Vietnamese and British flags come from [flag-icons](https://github.com/lipis/flag-icons),
  Copyright 2013 Panayiotis Lipiridis, used under the MIT license. See `MIT-flag-icons.txt`. The
  British flag is the upstream 1x1 artwork; the Vietnamese one is redrawn from the upstream 1x1
  artwork to avoid the element ids that a repeated inline icon would duplicate.

Neither project requires visible attribution. Both require their notices to travel with the
artwork, which is what the copied license files above do.
