import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
          '<li><strong>הכי פשוט:</strong> טרמינל אחד בתיקיית <code>MAIN</code> → <code>npm run dev:with-cbt</code> (מריץ גם את MAIN וגם את CBT על 5176).</li>' +
          '<li><code>cd backend</code> → <code>python app.py</code> (API לשמירת נתונים מהמשחק)</li>' +
          '<li>או בנפרד: <code>cd CBT</code> → <code>npm run dev</code>, ובמקביל <code>cd MAIN</code> → <code>npm run dev</code></li>' +
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
      '@math-games': path.resolve(__dirname, '../MATH-GAMES/src'),
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'socket.io-client': path.resolve(__dirname, 'node_modules/socket.io-client')
    }
  },
  server: {
    port: 5177,
    host: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:5000', ws: true },
      /* CBT – אותו מקור כמו READING (5177); חובה שגם CBT רץ (5176) */
      '/cbt': {
        target: 'http://127.0.0.1:5176',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          attachCbtProxyFriendlyError(proxy)
        }
      }
    }
  }
})
