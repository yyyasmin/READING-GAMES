import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** נרשם לפני ה-error handler הפנימי של Vite — מחזיר 502 + הסבר במקום 500 כש־משחק כדורגל לא רץ על 5177 */
function attachSoccerProxyFriendlyError(proxy) {
  proxy.on('error', (err, _req, res) => {
    try {
      if (!res || typeof res.writeHead !== 'function') return
      if (res.headersSent || res.writableEnded) return
      const detail = String(err && err.message ? err.message : 'unknown').replace(/</g, '&lt;')
      res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        '<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"/>' +
          '<title>כדורגל – ממשק לא זמין</title></head>' +
          '<body style="font-family:sans-serif;padding:1.5rem;line-height:1.5">' +
          '<h1>ממשק כדורגל (Vite) לא רץ על פורט 5177</h1>' +
          '<p><strong>מה להריץ (פיתוח מקומי):</strong></p>' +
          '<ol style="margin:0.5rem 0 1rem 1.2rem;line-height:1.65">' +
          '<li><code>cd backend</code> → <code>python app.py</code> (API)</li>' +
          '<li><code>cd SOCCER-GAME</code> → <code>npm run dev</code> — פורט <code>5177</code> (למשל <code>http://localhost:5177/soccer/</code>)</li>' +
          '<li>READING כאן כבר עם <code>npm run dev</code> — ואז רענון הדף</li>' +
          '</ol>' +
          '<p><small>פרט טכני: ' +
          detail +
          '</small></p>' +
          '</body></html>'
      )
    } catch {
      /* ignore */
    }
  })
}

/** ממשק לוח כדורגל CBT — פורט 5178 */
/** כדורגל העצמה — פורט 5179 */
function attachSoccerEmpowerProxyFriendlyError(proxy) {
  proxy.on('error', (err, _req, res) => {
    try {
      if (!res || typeof res.writeHead !== 'function') return
      if (res.headersSent || res.writableEnded) return
      const detail = String(err && err.message ? err.message : 'unknown').replace(/</g, '&lt;')
      res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        '<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"/>' +
          '<title>כדורגל העצמה — לא זמין</title></head>' +
          '<body style="font-family:sans-serif;padding:1.5rem;line-height:1.5">' +
          '<h1>ממשק «כדורגל העצמה» לא רץ על פורט 5179</h1>' +
          '<p><code>cd SOCCER-EMPOWERMENT-GAME</code> → <code>npm run dev</code></p>' +
          '<p><small>' + detail + '</small></p></body></html>'
      )
    } catch {
      /* ignore */
    }
  })
}

function attachSoccerBoardProxyFriendlyError(proxy) {
  proxy.on('error', (err, _req, res) => {
    try {
      if (!res || typeof res.writeHead !== 'function') return
      if (res.headersSent || res.writableEnded) return
      const detail = String(err && err.message ? err.message : 'unknown').replace(/</g, '&lt;')
      res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        '<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"/>' +
          '<title>לוח כדורגל CBT לא זמין</title></head>' +
          '<body style="font-family:sans-serif;padding:1.5rem;line-height:1.5">' +
          '<h1>ממשק «כדורגל CBT — לוח וקלפים» לא רץ על פורט 5178</h1>' +
          '<p><code>cd SOCCER-CBT-BOARD-GAME</code> → <code>npm run dev</code></p>' +
          '<p><small>' + detail + '</small></p></body></html>'
      )
    } catch {
      /* ignore */
    }
  })
}

/** נרשם לפני ה-error handler הפנימי של Vite — מחזיר 502 + הסבר במקום 500 כש־CBT לא רץ על 5176 */
function attachCbtProxyFriendlyError(proxy) {
  proxy.on('error', (err, _req, res) => {
    try {
      if (!res || typeof res.writeHead !== 'function') return
      if (res.headersSent || res.writableEnded) return
      const detail = String(err && err.message ? err.message : 'unknown').replace(/</g, '&lt;')
      res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        '<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"/>' +
          '<title>מלחמה – ממשק CBT לא זמין</title></head>' +
          '<body style="font-family:sans-serif;padding:1.5rem;line-height:1.5">' +
          '<h1>ממשק CBT (Vite) לא רץ על פורט 5176</h1>' +
          '<p><strong>למה:</strong> <code>python app.py</code> בתיקיית <code>backend</code> מפעיל רק את <strong>ה־API</strong> (בדרך כלל פורט 5000). ' +
          'האפליקציה הראשית מעבירה את <code>/cbt</code> לשרת פיתוח <strong>נפרד</strong> — פרויקט ה־React ב־<code>CBT</code> על <code>http://127.0.0.1:5176</code>. ' +
          'אין קשר בין פורט 5000 לבין 5176.</p>' +
          '<p><strong>מה להריץ (פיתוח מקומי):</strong></p>' +
          '<ol style="margin:0.5rem 0 1rem 1.2rem;line-height:1.65">' +
          '<li><code>cd backend</code> → <code>python app.py</code> (API + פרוקסי <code>/api</code> מה־CBT)</li>' +
          '<li><code>cd CBT</code> → <code>npm run dev</code> — עד שמופיע <code>5176</code> (למשל <code>http://localhost:5176/cbt/</code>)</li>' +
          '<li>READING כאן כבר עם <code>npm run dev</code> — ואז רענון הדף</li>' +
          '</ol>' +
          '<p><small>במקום שגיאת 500 שקטה של Vite, הוצגה כאן תשובת 502 עם הסבר. פרט טכני: ' +
          detail +
          '</small></p>' +
          '</body></html>'
      )
    } catch {
      /* ignore */
    }
  })
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@math-games': path.resolve(__dirname, '../MATH-GAMES/src')
    }
  },
  server: {
    port: 5175,
    host: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:5000', ws: true },
      /* CBT – אותו מקור כמו READING (5175); חובה שגם CBT רץ (5176) */
      '/cbt': {
        target: 'http://127.0.0.1:5176',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          attachCbtProxyFriendlyError(proxy)
        }
      },
      '/soccer': {
        target: 'http://127.0.0.1:5177',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          attachSoccerProxyFriendlyError(proxy)
        }
      },
      '/soccer-board': {
        target: 'http://127.0.0.1:5178',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          attachSoccerBoardProxyFriendlyError(proxy)
        }
      },
      '/soccer-empower': {
        target: 'http://127.0.0.1:5179',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          attachSoccerEmpowerProxyFriendlyError(proxy)
        }
      }
    }
  }
})
