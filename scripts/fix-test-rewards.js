#!/usr/bin/env node

/**
 * Fix test files to include required 'reward' field in LoyaltyProgram.create
 */

const fs = require('fs')
const path = require('path')

const testsDir = path.join(__dirname, '..', '__tests__')

// Read all test files
const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.ts'))

let totalFixed = 0

testFiles.forEach(file => {
  const filePath = path.join(testsDir, file)
  let content = fs.readFileSync(filePath, 'utf8')
  let modified = false

  // Pattern 1: Find loyaltyProgram.create blocks missing 'reward'
  // This regex finds create blocks that have pointsRequired but no reward
  const pattern1 = /(loyaltyProgram\.create\(\{[\s\S]*?data:\s*\{[\s\S]*?pointsRequired:\s*\d+)(\s*)([\s\S]*?\}[\s\S]*?\})/g

  content = content.replace(pattern1, (match, before, space, after) => {
    // Check if 'reward:' already exists in this block
    if (!match.includes('reward:')) {
      modified = true
      totalFixed++
      // Add reward field after pointsRequired
      return before + ',\n        reward: \'Test reward\'' + after
    }
    return match
  })

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8')
    console.log(`✓ Fixed ${file}`)
  }
})

console.log(`\n✓ Total fixes applied: ${totalFixed}`)
