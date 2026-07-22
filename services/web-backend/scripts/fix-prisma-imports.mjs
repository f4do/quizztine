import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { join, extname } from 'path'

const dir = new URL('../dist/prisma/generated/prisma', import.meta.url).pathname

function fixImports(filePath) {
  let content = readFileSync(filePath, 'utf-8')
  const original = content
  content = content.replace(/from\s+['"](\.\/[^'"]+)['"]/g, (match, specifier) => {
    if (specifier.endsWith('.js')) return match
    if (specifier.endsWith('.ts')) return match.replace(specifier, specifier.replace(/\.ts$/, '.js'))
    return match.replace(specifier, specifier + '.js')
  })
  if (content !== original) {
    writeFileSync(filePath, content)
    console.log(`  Fixed: ${filePath}`)
  }
}

function walk(dirPath) {
  for (const entry of readdirSync(dirPath)) {
    const fullPath = join(dirPath, entry)
    if (statSync(fullPath).isDirectory()) {
      walk(fullPath)
    } else if (extname(fullPath) === '.js') {
      fixImports(fullPath)
    }
  }
}

console.log('Fixing Prisma generated imports...')
walk(dir)
console.log('Done.')
