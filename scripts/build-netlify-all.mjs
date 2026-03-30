/**
 * One static site: hub at / + games under /ndfa, /ronit, /cbt, (optional) /math-english
 * Run from repo root: npm run build  → output in ./publish
 *
 * Local dev uses Vite proxies; production uses VITE_* env (see netlify.toml comments).
 */

import { rmSync, mkdirSync, cpSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publish = join(root, 'publish')

function sh(cwd, command) {
  console.log(`\n>> ${cwd}\n   ${command}\n`)
  execSync(command, { cwd, stdio: 'inherit', shell: true, env: process.env })
}

function npmInstall(dir) {
  const lock = join(dir, 'package-lock.json')
  sh(dir, existsSync(lock) ? 'npm ci' : 'npm install')
}

rmSync(publish, { recursive: true, force: true })
mkdirSync(publish, { recursive: true })

/* 1) Main menu + internal games (reading, math memory) — includes MATH-GAMES via Vite alias */
const hub = join(root, 'READING-MEMORY-GAME')
npmInstall(hub)
sh(hub, 'npx vite build')
cpSync(join(hub, 'dist'), publish, { recursive: true })

const apps = [
  { dir: 'NDFA-MEMORY-MATCH-GAME', base: '/ndfa/', sub: 'ndfa' },
  { dir: 'RONIT-MEMORY-GAME', base: '/ronit/', sub: 'ronit' },
  { dir: 'CBT', base: null, sub: 'cbt' }
]

for (const app of apps) {
  const appPath = join(root, app.dir)
  if (!existsSync(join(appPath, 'package.json'))) {
    throw new Error(`Missing package.json: ${app.dir}`)
  }
  npmInstall(appPath)
  if (app.base) {
    sh(appPath, `npx vite build --base ${app.base}`)
  } else {
    sh(appPath, 'npx vite build')
  }
  const out = join(publish, app.sub)
  mkdirSync(out, { recursive: true })
  cpSync(join(appPath, 'dist'), out, { recursive: true })
}

const redirects = [
  '/ndfa/* /ndfa/index.html 200',
  '/ronit/* /ronit/index.html 200',
  '/cbt/* /cbt/index.html 200'
]

const mathEnglish = join(root, 'MATH-ENGLISH-GAMES')
const mathAppJsx = join(mathEnglish, 'src', 'App.jsx')
if (existsSync(mathAppJsx)) {
  npmInstall(mathEnglish)
  sh(mathEnglish, 'npx vite build --base /math-english/')
  mkdirSync(join(publish, 'math-english'), { recursive: true })
  cpSync(join(mathEnglish, 'dist'), join(publish, 'math-english'), { recursive: true })
  redirects.push('/math-english/* /math-english/index.html 200')
} else {
  console.warn(
    '\n[build-netlify-all] Skipping MATH-ENGLISH-GAMES (src/App.jsx missing). Fix the app or remove from Netlify env URLs.\n'
  )
}

writeFileSync(join(publish, '_redirects'), redirects.join('\n') + '\n')

console.log('\n✓ Build finished. Deploy folder:', publish)
console.log(
  '  Set Netlify env for hub build: VITE_BACKEND_URL, VITE_NDFA_GAME_URL=/ndfa/, VITE_RONIT_GAME_URL=/ronit/, VITE_CBT_GAME_URL=/cbt/'
)
if (!existsSync(mathAppJsx)) {
  console.log('  (Omit VITE_MATH_ENGLISH_GAME_URL until MATH-ENGLISH-GAMES has App.jsx)\n')
} else {
  console.log('  VITE_MATH_ENGLISH_GAME_URL=/math-english/\n')
}
