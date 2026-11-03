# PSX Terminal Live Feed aur PSXBubbles — Mukammal Kaam ki Tafseel

Yeh document batata hai ke PSX Terminal se live quote feed lene, usay QuestDB mein rakhne, candles banane, chart par dikhane, Docker mein chalane, aur server ko kya nazar aa sakta hai—yeh sab kaise kaam karta hai.

## 1. Maqsad

PSXBubbles mein pehle paanch, phir in kul 10 PSX symbols ka live data dikhana tha:

- `LOADS`
- `BECO`
- `CNERGY`
- `OGDC`
- `DGKC`
- `HBL`
- `MEBL`
- `MARI`
- `PPL`
- `HUBC`

Pehle smoke phase mein pehle paanch symbols use hue. Baad mein scale-up ke pehle batch ke taur par upar wale paanch aur add kiye gaye; current Docker default total 10 symbols hai.

Purana fetch path kaam nahi kar raha tha, is liye us par depend karne ke bajaye PSX Terminal ke client feed se ek alag scraper banaya. Pehla maqsad ek symbol par feed samajhna tha; baad mein configuration paanch symbols tak barhai gayi. Naya flow alag service hai aur existing app ke purane data ko restore ya overwrite karne ke liye nahi bana.

## 2. Poora data flow

```text
PSX Terminal
    │  WebSocket: quote updates for 5 subscribed symbols
    ▼
psx-scraper Docker service
    ├── har valid quote ko JSON Lines log mein likhta hai
    ├── har quote ka raw snapshot QuestDB `psx_quotes` mein likhta hai
    ├── quotes se 1-minute OHLCV bars banata hai
    │       └── QuestDB `psx_1m_bars`
    └── live quote event Redis par publish karta hai
             │
             ├── API / Socket.IO ──► PSXBubbles live bubbles
             └── REST API ──────────► chart candles
```

QuestDB, Redis, API aur scraper local Docker containers ke darmiyan communicate karte hain. Feed connection PSX Terminal tak bahar jata hai. App/browser local Vite frontend se khulta hai.

## 3. Scraper PSX Terminal se kaise baat karta hai

1. Scraper `https://psxterminal.com/api/init` ko ek HTTP request bhejta hai aur connection token leta hai.
2. Token ke saath `wss://psxterminal.com/rt` par ek WebSocket connection kholta hai. Handshake mein `Origin: https://psxterminal.com` bhejta hai.
3. Feed ka `hello` frame milne par ek `subscribe` message bhejta hai. Is message mein ab 10 topic hote hain:

   ```text
   quote:REG:LOADS
   quote:REG:BECO
   quote:REG:CNERGY
   quote:REG:OGDC
   quote:REG:DGKC
   quote:REG:HBL
   quote:REG:MEBL
   quote:REG:MARI
   quote:REG:PPL
   quote:REG:HUBC
   ```

4. Feed ke quote frames MessagePack format mein decode hote hain. Scraper symbol, price, source timestamp, volume aur doosri available fields normalize karta hai.
5. Price ke baghair ya malformed messages skip hote hain. Duplicate/out-of-order source updates pehchane jate hain. Valid quote ka source time aur local receive time alag record hota hai.
6. Feed ping bheje to scraper pong deta hai. Agar socket band ho ya heartbeat ruk jaye to reconnect hota hai. Delay exponential backoff se barhta hai aur 30 seconds par cap hota hai.

Symbols `.env`/environment ke `PSXT_SYMBOLS` se set hote hain. Current Docker default yahi 10 symbols hai. Subscription market `PSXT_MARKET=REG` hai.

## 4. PSX Terminal ko kya nazar aa sakta hai?

Hamare implementation ke hisaab se scraper **ek process aur ek waqt mein ek WebSocket connection** chalata hai. Usi connection par ab 10 symbol topics subscribe hote hain. Yeh 10 browser tabs ya 10 alag screens kholne ke barabar nahi hai.

PSX Terminal ke server ko network level par kam az kam yeh nazar aa sakta hai:

- client ka public IP/network address aur connection ka waqt;
- `/api/init` requests, jo initial connection aur reconnect par hoti hain;
- `/rt` WebSocket connection aur uska duration;
- `Origin` header aur connection token;
- subscribe message mein 10 symbol topics;
- quote traffic aur heartbeat pong messages.

Lekin hum **yeh verify nahi kar sakte** ke PSX Terminal apne dashboard ya monitoring mein isay “10 screens”, “10 users”, “1 session”, “10 symbols” ya kisi aur label se count karta hai. Is server ke internal logs, account usage meter, detection rules ya billing logic ka hamein access nahi. Isliye “unko pata nahi chalega” ya “sirf ek screen count hogi” ki guarantee nahi di ja sakti. Sahi technical bayan yahi hai: hamari taraf se ek WebSocket connection hai aur us par 10 subscriptions hain.

User ne bataya tha ke PSX Terminal se permission le li hai. Yeh document us user-reported permission ko note karta hai; permission ka written scope/terms humne independently inspect nahi kiye. Agar permission mein automated WebSocket subscription, data storage aur personal/internal use ki hadain di gayi hon, to scraper ka use un hadon ke andar hi rehna chahiye.

## 5. Server load aur request pattern

- Har quote ke liye naya HTTP page request nahi bheja jata; ek persistent WebSocket par feed updates milti hain.
- Connection/reconnect par `/api/init` token request hoti hai.
- Scraper polling loop se har symbol ko baar-baar query nahi karta; updates feed bhejti hai.
- Heartbeat check har 15 seconds tak ke interval par hota hai, lekin pong sirf feed ke ping frame ke jawab mein bheja jata hai.
- Connection repeatedly fail ho to retry delay 1 second se barh kar maximum 30 seconds tak jata hai, jitter ke saath.

Yeh design repeated rapid page scraping ke muqable mein kam request wala hai, magar is se zero load, zero impact, ya PSX Terminal ki monitoring se invisibility sabit nahi hoti. Actual server-side cost aur policy classification sirf PSX Terminal confirm kar sakta hai.

## 6. QuestDB mein kya save hota hai

### `psx_quotes` — har valid feed update ka snapshot

Har accepted quote par ek naya row likha jata hai. Is mein yeh fields hoti hain:

- `symbol`
- `last_price`
- `cumulative_volume`
- `change_percent`
- `day_high`, `day_low`
- `market_status`, `market`
- `source_timestamp` — feed ke mutabiq waqt
- `received_at` — scraper ne quote kis waqt receive ki

Yeh raw snapshots hain; har row ek feed update ko represent karta hai. Table time partitioned hai.

### `psx_1m_bars` — 1-minute candles

Quote updates se minute ke andar:

- **Open:** minute mein pehla dekha gaya price
- **High:** minute mein sabse uncha dekha gaya price
- **Low:** minute mein sabse neecha dekha gaya price
- **Close:** minute mein aakhri dekha gaya price
- **Volume:** cumulative volume readings ke darmiyan izafa

Candle tab finalize ho kar likhi jati hai jab scraper ko agle minute ka quote milta hai. Ek minute mein quote na aaye to khaali candle invent nahi hoti. Same `(received_at, symbol)` candle ko retry/restart se dobara banne se bachane ke liye QuestDB deduplication enabled hai.

Volume ke bare mein ek aham had: scraper apne pehle dekhe cumulative volume ko baseline banata hai. Isliye scraper start/restart ke foran baad pehli observed reading se pehle hua volume uske naye in-memory delta mein shamil nahi hota; uske baad ke cumulative increments count hote hain. Yeh exchange ka per-trade volume feed nahi, cumulative quote volume se nikla hua estimate hai.

Shutdown ke waqt adhoori current-minute candle flush nahi hoti, taake restart par usi minute ka duplicate row na bane. Iska matlab market close ke bilkul aakhri partial minute ka bar miss ho sakta hai.

## 7. Bade chart intervals kaise bante hain

QuestDB mein base candles 1-minute ki hain. API `SAMPLE BY` aggregation se inko request par bade intervals mein group karti hai:

- `1m`
- `5m`
- `15m`
- `1h`
- `4h`
- `Day`
- `Week`
- `Month`
- `Year`

Har interval ki alag database table nahi banti. Misal ke taur par 5-minute candle mein us bucket ke 1-minute opens/highs/lows/closes aur volume combine hote hain. Chart interval badalne par CoinModal selected interval API ko bhejta hai.

Live candles API ki misaal:

```text
http://localhost:8080/api/psx-candles?symbol=CNERGY&interval=5m&limit=100
```

Raw latest quote API:

```text
http://localhost:8080/api/psx-quotes
```

Historical candles ka backfill nahi kiya gaya. Isliye 1h/Day/Week/Month/Year select karne par jab tak feed se kafi waqt ka data jama na ho, candles kam hongi. API ki sample intervals QuestDB ke `SAMPLE BY` par mabni hain.

## 8. App mein kya wired hai

- `VITE_PSX_QUOTE_FEED=true` par bubbles dedicated `/api/psx-quotes` route se configured symbols load karte hain; current default 10 hai.
- API quote age calculate karti hai. Receive/source age 60 seconds se zyada ho, ya timestamp na ho, to `stale=true` milta hai.
- Bubble tooltip mein `QUOTE FRESH` ya `STALE QUOTE`, source update ki age, aur market status dikh sakta hai.
- Coin modal ka candle chart PSX candle API use karta hai. PSX feed mode mein 1-minute interval default hai; dropdown supported intervals dikhata hai.
- Chart data automatic refresh hota hai. Indicators chart series ke candle data par chal sakte hain, magar har indicator ki PSX feed ke saath accuracy/behavior abhi individually end-to-end verify nahi ki gayi.
- Bubble screener ke tamam metrics ko 1-minute history se aaya hua na samjhein. Jo bubble values quote endpoint se hain woh quote snapshots hain; unhein historical OHLCV series samajhna ghalat hoga.

## 9. Staleness aur real-time ka matlab

“Live” ka matlab yeh nahi ke har symbol ka naya trade har second aayega. Source jab quote update deta hai tabhi naya quote aata hai. Kam traded symbol—jaise kabhi `LOADS`—ka aakhri quote zyada der tak wahi reh sakta hai. Source timestamp aur receive timestamp isi farq ko dikhate hain.

Scraper ka connection-level stale diagnostic tab warning deta hai jab kisi bhi symbol ka quote 30 seconds tak na mile; yeh symbol-by-symbol warning nahi. API alag har symbol ke latest row se freshness nikalti hai, aur 60 seconds se purana source/receive time stale mark hota hai. Market band hone par last quote aur last candle reh sakte hain; woh naye trade ka saboot nahi.

Source ki apni update cadence, network delay aur market activity ki wajah se update delay badal sakta hai. Pehle smoke checks mein active symbols ki kuch updates scraper tak takriban aadhe second mein aayi thin, lekin yeh guaranteed service-level timing nahi. Kuch illiquid/stale source examples is se zyada delay ke thay.

## 10. Docker mein chalana aur dekhna

Is workspace ki running stack `psxbubbles-main` Compose project hai. Scraper ko isi project/network par chalane ke commands:

```powershell
docker compose -p psxbubbles-main -f docker-compose.dev.yml up -d --no-deps --build psx-scraper
docker compose -p psxbubbles-main -f docker-compose.dev.yml logs -f psx-scraper
docker compose -p psxbubbles-main -f docker-compose.dev.yml stop psx-scraper
```

Logs mein `connected`, `subscribed`, `quote_written`, `quote_sink_failed` aur `minute_candle_written` events dekhein. API ko `http://localhost:8080`, frontend ko `http://localhost:5173` se dekha ja sakta hai. Docker Compose project name doosra ho to services ko usi project/network ke saath configure karna zaroori hai, taake scraper usi Redis aur QuestDB ko use kare jo API use karti hai.

## 11. Ab tak kya check hua

- Pehle scraper feed se paanch symbol topics subscribe karta dikha. Scale-up ke baad 10 topics subscribe hue.
- Market status `OPN` receive hua aur quotes QuestDB/API tak pohnche.
- `/api/psx-quotes` ne pehle paanch aur scale-up ke baad 10 symbols return kiye.
- QuestDB mein `psx_quotes` rows count hue.
- `psx_1m_bars` table create hui aur 1-minute records query kiye gaye.
- CNERGY ki candles API aur chart par dekhi gayi.
- `5m`, `15m`, `1h`, `4h`, `Day`, `Week`, `Month`, `Year` API interval aggregation responses check kiye gaye; 5m chart selector mein badal kar candle display dekha.
- Docker scraper service auto-restart policy `unless-stopped` ke saath chalti hai.

Yeh smoke verification hai, har possible reconnect, har symbol ke missing intervals, indicator formula, market-close scenario, ya PSX Terminal ke internal monitoring behavior ka exhaustive proof nahi.

## 12. Abhi kya baqi/uncertain hai

1. PSX Terminal se permission ke exact written terms/scope ko document ke saath verify karna.
2. Historical OHLCV backfill ka authorized source tay karna, taake indicators ko kafi purana data mile.
3. Zaroori indicators ko ek ek karke PSX candle intervals par check karna.
4. Symbol-wise stale status ko chart/bubble UI mein tooltip ke ilawa aur visible jagah dikhana agar user ko chahiye.
5. Scraper restart ke baad volume baseline aur adhoori candle ka behavior production expectations ke mutabiq decide karna.
6. PSX Terminal se yeh specifically confirm karna ke ek WebSocket mein 10 subscriptions unke account/license/usage rules mein kaise count hoti hain. Sirf hamari taraf ka connection count dekh kar unke “screens” counter ka jawab nahi milta.

## 13. Code ke aham maqamat

- `scraper/client.mjs` — token lena, WebSocket, subscribe, ping/pong, normalize, order checks, reconnect
- `scraper/quote.mjs` — feed frame ko standard quote event mein normalize karna
- `scraper/questdb-sink.mjs` — QuestDB snapshots/candles aur Redis live publication
- `scraper/index.mjs` — scraper process aur signal shutdown handling
- `docker-compose.dev.yml` — `psx-scraper` service
- `server/api/routes/psx-quotes.mjs` — latest quote aur freshness API
- `server/api/routes/psx-candles.mjs` — 1m candles aur aggregated intervals API
- `src/hooks/useOHLCV.js` — live quote endpoint se bubble data
- `src/components/CoinModal.jsx` — candle interval API selection
- `src/components/BubbleTooltip.jsx` — quote freshness label

---

Yeh record engineering implementation aur observed behavior ka hai. PSX Terminal ki internal monitoring ya unki taraf se usage ki classification ke bare mein koi andaza fact ke taur par pesh nahi kiya gaya.
