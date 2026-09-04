# @lokdarpan/contracts

## 0.1.0

### Minor Changes

- f714c0e: Add an OCR service boundary: a witness, not an authority.

  522 of the corpus's 4,586 pages have no text layer and 45 more have one that is
  present and wrong, so those pages need an engine that guesses. Every other stage
  either reads a figure exactly or refuses it, and attaching a guess to a
  government figure with a source link beside it is the most dangerous thing this
  project could build. The contract is shaped around that.

  A reading carries the engine, its exact version read from the installed engine,
  the model versions, the languages it was told to read, and the render it came
  from. Nothing is merged: two engines reading one page produce two readings, and
  there is no field for a consensus value. An absence is a stated refusal naming
  its reason — "not installed", "found no text" and "blank page" stay three
  different facts.

  A reading arrives in the shape the text layer already produces: content plus
  items carrying a character span and a box in PDF points, unrotated. So a figure
  found by OCR is located, cited and reviewed by the code that already exists. The
  Python ends at the contract; the TypeScript pipeline is untouched.

  The two sides are checked against the same bytes — five examples and eight
  counter-examples under `services/ocr/contract/`. The two sides cannot be
  type-checked against each other, so loosening one alone fails a test.

  Engine licences were verified from each package's own metadata rather than from
  documentation about them, which corrected a claim this repository had recorded
  from memory: Surya is Apache-2.0, not GPL. PaddleOCR, Tesseract, pytesseract,
  docTR and pypdfium2 are all usable under Apache-2.0, with exact versions
  recorded.

  No accuracy claim appears anywhere in this change. Which engine reads these
  documents better is measured on the real pages, next.
