/**
 * Join Form Text Color Regression Test
 *
 * Prevents regression where form labels and text inherit hero color (white)
 * instead of having explicit dark colors on white background.
 *
 * ROOT CAUSE OF REGRESSION:
 * - Hero section uses inline style: color: textColor (white for contrast)
 * - Form elements without explicit color classes may inherit parent colors
 * - Result: white text on white background = invisible
 *
 * PREVENTION:
 * - Form title must have explicit text-gray-900
 * - Form labels must have explicit text-gray-700
 * - Input text must have explicit text-gray-900
 * - Placeholders must have explicit placeholder:text-gray-400
 * - These classes have higher specificity than inherited colors
 */

describe('Join Form Text Colors', () => {
  const joinPagePath = 'app/join/[businessSlug]/page.tsx'

  it('form title has explicit dark color (not inherited from hero)', () => {
    const fs = require('fs')
    const content = fs.readFileSync(joinPagePath, 'utf-8')

    // Title: "¡Únete a nuestro programa!"
    const titleRegex = /<h2[^>]*>¡Únete a nuestro programa!</
    const titleMatch = content.match(titleRegex)

    expect(titleMatch).toBeTruthy()

    // Extract the full tag
    const titleStart = content.indexOf(titleMatch![0])
    const titleTag = content.substring(titleStart, content.indexOf('>', titleStart) + 1)

    // Must have explicit dark text color
    expect(titleTag).toMatch(/text-gray-900/)
  })

  it('form labels have explicit dark color (not inherited)', () => {
    const fs = require('fs')
    const content = fs.readFileSync(joinPagePath, 'utf-8')

    // All three labels: Nombre *, Apellido, Teléfono *
    const labelRegexes = [
      /<label[^>]*>Nombre \*/,
      /<label[^>]*>Apellido/,
      /<label[^>]*>Teléfono \*/
    ]

    labelRegexes.forEach((regex, index) => {
      const match = content.match(regex)
      expect(match).toBeTruthy()

      const labelStart = content.indexOf(match![0])
      const labelTag = content.substring(labelStart, content.indexOf('>', labelStart) + 1)

      // Must have explicit gray-700 color
      expect(labelTag).toMatch(/text-gray-700/)
    })
  })

  it('input fields have explicit text color and placeholder color', () => {
    const fs = require('fs')
    const content = fs.readFileSync(joinPagePath, 'utf-8')

    // Find all input elements within the form
    const formSection = content.substring(
      content.indexOf('<form onSubmit={handleSubmit}'),
      content.indexOf('</form>')
    )

    const inputRegex = /<input[^>]*>/g
    const inputs = formSection.match(inputRegex) || []

    // Should have at least 3 inputs (firstName, lastName, phone)
    expect(inputs.length).toBeGreaterThanOrEqual(3)

    // Filter text/tel inputs (exclude checkbox)
    const textInputs = inputs.filter((input: string) =>
      input.includes('type="text"') || input.includes('type="tel"')
    )

    expect(textInputs.length).toBeGreaterThanOrEqual(3)

    textInputs.forEach((input: string) => {
      // Must have explicit text color for input value
      expect(input).toMatch(/text-gray-900/)

      // Must have explicit placeholder color
      expect(input).toMatch(/placeholder:text-gray-/)
    })
  })

  it('hero uses dynamic textColor but form does not inherit it', () => {
    const fs = require('fs')
    const content = fs.readFileSync(joinPagePath, 'utf-8')

    // Hero should use inline style with textColor
    expect(content).toMatch(/style=\{\{[^}]*color:\s*textColor/)

    // CardContent (form container) should NOT have color: textColor
    const cardContentRegex = /<CardContent[^>]*>/g
    const cardContents = content.match(cardContentRegex) || []

    cardContents.forEach((tag: string) => {
      // Should not have inline color style
      expect(tag).not.toMatch(/style=\{\{[^}]*color:/)
    })
  })

  it('description text maintains gray-600 (already correct)', () => {
    const fs = require('fs')
    const content = fs.readFileSync(joinPagePath, 'utf-8')

    // Within CardContent, description should have text-gray-600
    const descriptionRegex = /<p className="text-gray-600">\s*\{programDescription\}/

    expect(content).toMatch(descriptionRegex)
  })

  it('terms and conditions label has explicit gray color', () => {
    const fs = require('fs')
    const content = fs.readFileSync(joinPagePath, 'utf-8')

    // Terms label should have text-gray-600
    const termsLabelRegex = /<label htmlFor="terms"[^>]*className="[^"]*text-gray-600/

    expect(content).toMatch(termsLabelRegex)
  })
})
