#!/usr/bin/env node

/**
 * Production Super Admin Bootstrap
 *
 * Creates or promotes the first SUPER_ADMIN user in production.
 *
 * Security features:
 * - Reads password without echoing
 * - Uses same bcrypt hashing as application
 * - No credentials in argv, logs, or files
 * - Idempotent: safe to run multiple times
 * - Validates email, password strength
 *
 * Usage (production):
 *   docker compose --env-file .env.production -f docker-compose.production.yml \
 *     run --rm app node scripts/create-super-admin.js
 *
 * Usage (local development):
 *   node scripts/create-super-admin.js
 */

const readline = require('readline');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Password requirements
const MIN_PASSWORD_LENGTH = 12;
const BCRYPT_ROUNDS = 12;

/**
 * Read input from stdin without echoing (for passwords)
 * Uses process.stdin.setRawMode for proper TTY handling
 */
function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    // Write prompt
    process.stdout.write(prompt);

    let input = '';
    const stdin = process.stdin;

    // Check if stdin is a TTY (terminal)
    if (!stdin.isTTY) {
      // Fallback for non-TTY (piped input, testing)
      const rl = readline.createInterface({
        input: stdin,
        output: process.stdout,
        terminal: false
      });

      rl.once('line', (line) => {
        rl.close();
        process.stdout.write('\n');
        resolve(line);
      });
      return;
    }

    // TTY mode: disable echo manually
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (char) => {
      // Handle different control characters
      if (char === '\u0003') {
        // Ctrl+C
        cleanup();
        process.stdout.write('\n');
        reject(new Error('Cancelled by user'));
        process.exit(1);
      } else if (char === '\r' || char === '\n') {
        // Enter key
        cleanup();
        process.stdout.write('\n');
        resolve(input);
      } else if (char === '\u007f' || char === '\b') {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          // Move cursor back, write space, move back again
          process.stdout.write('\b \b');
        }
      } else if (char >= ' ' && char <= '~') {
        // Printable characters only
        input += char;
        // Don't echo the character (that's the point of hidden input)
      }
    };

    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };

    stdin.on('data', onData);
  });
}

/**
 * Read visible input
 */
function readVisible(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Normalize email (lowercase, trim)
 */
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

/**
 * Validate password strength
 */
function validatePassword(password) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }

  // Check for basic complexity
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter || !hasNumber) {
    return 'Password must contain both letters and numbers';
  }

  return null; // Valid
}

/**
 * Hash password using bcrypt (same as application)
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Check if user exists and return their current role
 */
async function findExistingUser(email) {
  return await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  });
}

/**
 * Create new SUPER_ADMIN user
 */
async function createSuperAdmin(email, name, hashedPassword) {
  return await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: hashedPassword,
      role: 'SUPER_ADMIN'
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  });
}

/**
 * Promote existing user to SUPER_ADMIN
 */
async function promoteToSuperAdmin(userId) {
  return await prisma.user.update({
    where: { id: userId },
    data: { role: 'SUPER_ADMIN' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  });
}

/**
 * Main bootstrap flow
 */
async function main() {
  console.log('=== IntusPath Loyalty - Production Super Admin Bootstrap ===\n');

  try {
    // Step 1: Collect email
    let email = await readVisible('Email: ');
    email = normalizeEmail(email);

    if (!isValidEmail(email)) {
      console.error('❌ Invalid email format');
      process.exit(1);
    }

    // Step 2: Check if user already exists
    const existingUser = await findExistingUser(email);

    if (existingUser) {
      console.log(`\n⚠️  User already exists:`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Name: ${existingUser.name}`);
      console.log(`   Role: ${existingUser.role}\n`);

      if (existingUser.role === 'SUPER_ADMIN') {
        console.log('✅ User is already a SUPER_ADMIN. No action needed.');
        process.exit(0);
      }

      // Existing user is not SUPER_ADMIN - ask to promote
      const confirm = await readVisible(
        'Promote this user to SUPER_ADMIN? (yes/no): '
      );

      if (confirm.toLowerCase() !== 'yes') {
        console.log('❌ Operation cancelled');
        process.exit(1);
      }

      const promoted = await promoteToSuperAdmin(existingUser.id);
      console.log('\n✅ User promoted to SUPER_ADMIN:');
      console.log(`   Email: ${promoted.email}`);
      console.log(`   Name: ${promoted.name}`);
      console.log(`   Role: ${promoted.role}`);

      process.exit(0);
    }

    // Step 3: New user - collect name
    const name = await readVisible('Name: ');

    if (!name || name.trim().length === 0) {
      console.error('❌ Name is required');
      process.exit(1);
    }

    // Step 4: Collect password (hidden)
    const password = await readHidden('Password: ');

    const passwordError = validatePassword(password);
    if (passwordError) {
      console.error(`❌ ${passwordError}`);
      process.exit(1);
    }

    // Step 5: Confirm password
    const passwordConfirm = await readHidden('Confirm password: ');

    if (password !== passwordConfirm) {
      console.error('❌ Passwords do not match');
      process.exit(1);
    }

    // Step 6: Hash password
    console.log('\n🔐 Hashing password...');
    const hashedPassword = await hashPassword(password);

    // Step 7: Create user
    console.log('💾 Creating SUPER_ADMIN user...');
    const user = await createSuperAdmin(email, name.trim(), hashedPassword);

    console.log('\n✅ SUPER_ADMIN created successfully:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user.id}\n`);

    console.log('⚠️  IMPORTANT: Store the password securely. It cannot be recovered.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for testing
module.exports = {
  normalizeEmail,
  validatePassword,
  hashPassword,
  isValidEmail
};
