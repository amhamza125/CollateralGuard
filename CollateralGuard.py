# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json
# ---------------------------------------------------------------------------

_SUPPORTED_DEBT_STABLECOINS = ("USDT", "USDC", "DAI")
_MAX_POSITIONS = 5000
_MAX_HISTORY_LIMIT = 200
_MAX_PRICE_DEVIATION_BPS = 300      # sources must sit within 3% of the median
_MAX_GECKO_STALENESS_SECONDS = 900  # gecko timestamp vs binance server time


class CollateralGuard(gl.Contract):
    global_threshold: bigint
    protocol_paused: bool          # owner-only emergency stop -- never auto-set by a check
    positions: TreeMap[str, str]            # position_id -> JSON position
    position_index: TreeMap[bigint, str]    # index -> position_id, registration order
    position_count: bigint
    account_positions: TreeMap[str, str]    # account address -> JSON list of position_ids
    check_history: TreeMap[bigint, str]     # sequence number -> JSON payload
    owner: str
    total_checks: bigint
    activity_count: bigint

    def __init__(self):
        self.global_threshold = 150
        self.protocol_paused = False
        self.position_count = 0
        self.owner = str(gl.message.sender_address)
        self.total_checks = 0
        self.activity_count = 0

    # -- internal helpers -------------------------------------------------
    def _symbol_of(self, asset: str) -> str:
        symbol = asset.upper()
        if "BTC" in symbol:
            return "BTC"
        if "ETH" in symbol:
            return "ETH"
        if "SOL" in symbol:
            return "SOL"
        raise gl.vm.UserError(
            "UNSUPPORTED_ASSET: collateral asset '" + asset + "' is not supported "
            "(supported: BTC, ETH, SOL)"
        )

    def _validate_debt_asset(self, debt_asset: str) -> None:
        if not debt_asset or debt_asset.upper() not in _SUPPORTED_DEBT_STABLECOINS:
            raise gl.vm.UserError(
                "UNSUPPORTED_DEBT_ASSET: debt asset '" + str(debt_asset) + "' must be "
                "a USD stablecoin (USDT, USDC, DAI)"
            )

    def _position_id(self, account_address: str, position_label: str) -> str:
        label = position_label.strip()
        if not label:
            raise gl.vm.UserError("INVALID_LABEL: position label must be non-empty")
        if "#" in label:
            raise gl.vm.UserError("INVALID_LABEL: position label must not contain '#'")
        if len(label) > 64:
            raise gl.vm.UserError("INVALID_LABEL: position label too long (max 64 chars)")
        return account_address + "#" + label

    def _log_activity(self, payload: dict) -> None:
        self.activity_count += 1
        self.check_history[self.activity_count] = json.dumps(payload)

    # -- writes -----------------------------------------------------------
    @gl.public.write
    def add_position(
        self,
        position_label: str,
        collateral_amount: int,
        debt_amount: int,
        collateral_asset: str,
        debt_asset: str,
    ) -> str:
        # AUTHENTICATION: the position is bound to the transaction sender.
        # There is deliberately no account parameter -- a wallet can only
        # ever register positions for itself.
        account_address = str(gl.message.sender_address)

        if collateral_amount <= 0 or debt_amount <= 0:
            raise gl.vm.UserError("INVALID_AMOUNT: collateral and debt must be positive integers")

        pid = self._position_id(account_address, position_label)
        if pid in self.positions:
            raise gl.vm.UserError("ALREADY_MONITORED: this position is already registered")

        # Fail fast on bad assets (raises on unsupported input).
        self._symbol_of(collateral_asset)
        self._validate_debt_asset(debt_asset)

        if int(self.position_count) >= _MAX_POSITIONS:
            raise gl.vm.UserError("POSITION_LIMIT_REACHED: maximum monitored positions reached")

        label = position_label.strip()
        self.positions[pid] = json.dumps({
            "account": account_address,
            "label": label,
            "collateral_amount": collateral_amount,
            "debt_amount": debt_amount,
            "collateral_asset": collateral_asset,
            "debt_asset": debt_asset,
            # SIMULATION LABEL: amounts are declared by the user and are
            # NOT verified against any lending protocol.
            "origin": "USER_DECLARED_SIMULATION",
            "status": "UNVERIFIED",
            "locked": False,
            "last_ratio": 0,
            "ai_sentiment": "N/A",
            "price_source": "N/A",
            "price_used": 0,
            "sources_agreed": 0,
            "last_message": "Registered as a user-declared simulation. Awaiting first manual check -- not yet assessed.",
            "last_checked": "NEVER",
            "added_by": account_address,
        })

        self.position_index[self.position_count] = pid
        self.position_count += 1

        if account_address in self.account_positions:
            ids = json.loads(self.account_positions[account_address])
        else:
            ids = []
        ids.append(pid)
        self.account_positions[account_address] = json.dumps(ids)

        self._log_activity({
            "type": "ADD",
            "position_id": pid,
            "account": account_address,
            "label": label,
            "asset": collateral_asset,
            "collateral_amount": collateral_amount,
            "debt_amount": debt_amount,
            "debt_asset": debt_asset,
            "origin": "USER_DECLARED_SIMULATION",
            "message": f"POSITION_ADDED (user-declared simulation): {collateral_amount} {collateral_asset} collateral vs {debt_amount} {debt_asset} debt",
        })
        return f"POSITION_ADDED: {pid} registered as a user-declared simulation, status UNVERIFIED."

    @gl.public.write
    def check_and_protect(self, position_id: str) -> str:
        if self.protocol_paused:
            raise gl.vm.UserError("PROTOCOL_PAUSED: owner has engaged the emergency stop")
        if position_id not in self.positions:
            raise gl.vm.UserError("POSITION_NOT_FOUND")

        pos = json.loads(self.positions[position_id])
        if pos.get("locked"):
            raise gl.vm.UserError("POSITION_LOCKED: this position breached previously -- it must be resumed before it can be checked again")

        symbol = self._symbol_of(pos["collateral_asset"])
        collateral_amount = pos["collateral_amount"]
        debt_amount = pos["debt_amount"]
        threshold = self.global_threshold

        def evaluate():
            if symbol == "BTC":
                coinbase_pair, gecko_id = "BTC-USD", "bitcoin"
                kraken_pair, bitstamp_pair = "XBTUSD", "btcusd"
            elif symbol == "SOL":
                coinbase_pair, gecko_id = "SOL-USD", "solana"
                kraken_pair, bitstamp_pair = "SOLUSD", "solusd"
            else:
                coinbase_pair, gecko_id = "ETH-USD", "ethereum"
                kraken_pair, bitstamp_pair = "ETHUSD", "ethusd"

            # --- corroborated price fetch: ALL sources, not a fallback chain
            observations = []  # (source, price_int)
            binance_close_time = 0
            change_24h = ""
            try:
                raw = gl.nondet.web.render(
                    f"https://api.binance.com/api/v3/ticker/24hr?symbol={symbol}USDT",
                    mode="text",
                )
                tick = json.loads(raw)
                p = int(float(tick["lastPrice"]))
                if p > 0:
                    observations.append(("binance", p))
                    binance_close_time = int(tick.get("closeTime", 0)) // 1000
                    change_24h = str(tick.get("priceChangePercent", ""))
            except Exception:
                pass
            try:
                raw = gl.nondet.web.render(
                    f"https://api.coinbase.com/v2/prices/{coinbase_pair}/spot",
                    mode="text",
                )
                p = int(float(json.loads(raw)["data"]["amount"]))
                if p > 0:
                    observations.append(("coinbase", p))
            except Exception:
                pass
            gecko_ts = 0
            try:
                raw = gl.nondet.web.render(
                    f"https://api.coingecko.com/api/v3/simple/price?ids={gecko_id}&vs_currencies=usd&include_last_updated_at=true",
                    mode="text",
                )
                g = json.loads(raw)[gecko_id]
                p = int(float(g["usd"]))
                gecko_ts = int(g.get("last_updated_at", 0))
                if p > 0:
                    observations.append(("coingecko", p))
            except Exception:
                pass
            try:
                raw = gl.nondet.web.render(
                    f"https://api.kraken.com/0/public/Ticker?pair={kraken_pair}",
                    mode="text",
                )
                result = json.loads(raw)["result"]
                ticker = next(iter(result.values()))
                p = int(float(ticker["c"][0]))
                if p > 0:
                    observations.append(("kraken", p))
            except Exception:
                pass
            try:
                raw = gl.nondet.web.render(
                    f"https://www.bitstamp.net/api/v2/ticker/{bitstamp_pair}/",
                    mode="text",
                )
                p = int(float(json.loads(raw)["last"]))
                if p > 0:
                    observations.append(("bitstamp", p))
            except Exception:
                pass

            # --- staleness: gecko must not lag binance server time
            if gecko_ts > 0 and binance_close_time > 0:
                if binance_close_time - gecko_ts > _MAX_GECKO_STALENESS_SECONDS:
                    observations = [o for o in observations if o[0] != "coingecko"]

            if len(observations) < 2:
                raise gl.vm.UserError(
                    "PRICE_FEED_UNAVAILABLE: fewer than two independent price "
                    "sources reachable -- check reverted, position state untouched"
                )

            # --- deviation: every used source within 3% of the median
            prices = sorted(p for _, p in observations)
            median = prices[len(prices) // 2]
            agreed = [
                (s, p) for s, p in observations
                if abs(p - median) * 10000 <= median * _MAX_PRICE_DEVIATION_BPS
            ]
            if len(agreed) < 2:
                return json.dumps({
                    "price_status": "CONFLICT",
                    "ratio": 0, "breach": False, "sentiment": "INVALID",
                    "price_source": "conflict:" + ",".join(s for s, _ in observations),
                    "price_used": median, "sources_agreed": len(agreed),
                }, sort_keys=True)

            price = median
            price_source = "+".join(s for s, _ in agreed)
            collateral_value = collateral_amount * price
            ratio = int((collateral_value * 100) // debt_amount) if debt_amount > 0 else 9999
            breach = ratio < threshold

            # --- sentiment, grounded in external market evidence
            fng_value = ""
            fng_class = ""
            try:
                raw = gl.nondet.web.render(
                    "https://api.alternative.me/fng/?limit=1", mode="text"
                )
                fng = json.loads(raw)["data"][0]
                fng_value = str(fng["value"])
                fng_class = str(fng["value_classification"])
            except Exception:
                pass

            sentiment = "INVALID"
            if change_24h != "" or fng_value != "":
                prompt = (
                    f"DeFi lending position '{pos['label']}': {collateral_amount} {symbol} "
                    f"collateral against {debt_amount} {pos['debt_asset']} debt. Collateral "
                    f"ratio {ratio}% (safety threshold {threshold}%). Market evidence: "
                    f"{symbol} 24h price change {change_24h or 'unknown'}%, Crypto Fear & "
                    f"Greed Index {fng_value or 'unknown'} ({fng_class or 'unknown'}). "
                    f"As a risk engine, classify current market sentiment for this "
                    f"position. Respond ONLY with JSON: "
                    f"{{\"sentiment\": \"CATASTROPHIC\"}} or {{\"sentiment\": \"NEUTRAL\"}}."
                )
                try:
                    ai_output = gl.nondet.exec_prompt(prompt, response_format="json")
                    if isinstance(ai_output, dict):
                        parsed = ai_output
                    else:
                        parsed = json.loads(str(ai_output))
                    s = parsed.get("sentiment", "")
                    if s in ("CATASTROPHIC", "NEUTRAL"):
                        sentiment = s
                    # any other shape/value stays INVALID -- never coerced
                except Exception:
                    sentiment = "INVALID"

            return json.dumps({
                "price_status": "OK",
                "ratio": ratio,
                "breach": breach,
                "sentiment": sentiment,
                "price_source": price_source,
                "price_used": price,
                "sources_agreed": len(agreed),
            }, sort_keys=True)

        agreed = gl.eq_principle.prompt_comparative(
            evaluate,
            principle=(
                "Validators must agree on the categorical outcomes: the price "
                "status (OK or CONFLICT), whether the collateral ratio breaches "
                "the safety threshold (the same breach boolean, when prices are "
                "OK), and the sentiment category (CATASTROPHIC, NEUTRAL or "
                "INVALID). Exact prices and ratios may vary slightly because "
                "each validator independently fetches live prices from up to "
                "five sources (Binance, Coinbase, CoinGecko, Kraken, Bitstamp) "
                "and corroborates them."
            ),
        )
        data = json.loads(agreed)

        self.total_checks += 1

        # Conflicting observations: record the event, change NOTHING about
        # the position's assessed state. A conflict is not evidence of
        # safety and not evidence of breach.
        if data["price_status"] == "CONFLICT":
            pos["last_checked"] = f"CHECK #{self.total_checks}"
            pos["last_message"] = (
                "PRICE_CONFLICT: independent sources disagreed beyond 3% -- "
                "assessment skipped, previous state kept"
            )
            self.positions[position_id] = json.dumps(pos)
            self._log_activity({
                "type": "CHECK_CONFLICT",
                "trigger": "MANUAL",
                "seq": int(self.total_checks),
                "position_id": position_id,
                "account": pos["account"],
                "label": pos["label"],
                "asset": pos["collateral_asset"],
                "price_source": data["price_source"],
                "message": pos["last_message"],
            })
            return pos["last_message"]

        ratio = data["ratio"]
        breach = data["breach"]
        sentiment = data["sentiment"]
        price_source = data["price_source"]

        pos["price_source"] = price_source
        pos["price_used"] = data["price_used"]
        pos["sources_agreed"] = data["sources_agreed"]
        pos["last_ratio"] = ratio
        pos["ai_sentiment"] = sentiment
        pos["last_checked"] = f"CHECK #{self.total_checks}"

        if breach:
            pos["status"] = "CRITICAL"
            pos["locked"] = True
            pos["last_message"] = (
                f"CRITICAL_BREACH: ratio {ratio}% < {threshold}% -- record flagged "
                f"LOCKED (monitoring flag only; no external assets are controlled). "
                f"Resume required before further checks [price: {price_source}]"
            )
        elif sentiment == "CATASTROPHIC":
            pos["status"] = "WARNING"
            pos["last_message"] = (
                f"AI_CONSENSUS_WARNING: ratio {ratio}% held, but evidence-grounded "
                f"AI consensus detected catastrophic market sentiment [price: {price_source}]"
            )
        else:
            # Sentiment is NEUTRAL or INVALID here. INVALID is recorded as
            # such -- the SAFE verdict below rests on the ratio alone.
            pos["status"] = "SAFE"
            note = "AI sentiment NEUTRAL" if sentiment == "NEUTRAL" else "sentiment unavailable/invalid -- verdict from corroborated ratio only"
            pos["last_message"] = (
                f"RATIO_SAFE: ratio {ratio}% is healthy -- {note} [price: {price_source}]"
            )

        self.positions[position_id] = json.dumps(pos)

        self._log_activity({
            "type": "CHECK",
            "trigger": "MANUAL",
            "seq": int(self.total_checks),
            "position_id": position_id,
            "account": pos["account"],
            "label": pos["label"],
            "asset": pos["collateral_asset"],
            "ratio": ratio,
            "status": pos["status"],
            "sentiment": sentiment,
            "price_source": price_source,
            "price_used": data["price_used"],
            "sources_agreed": data["sources_agreed"],
            "message": pos["last_message"],
        })
        return pos["last_message"]

    @gl.public.write
    def resume_position(self, position_id: str) -> str:
        """Position account or contract owner: clears a locked (CRITICAL)
        position. The position returns to UNVERIFIED -- it is NOT safe
        until a fresh check assesses it again."""
        if position_id not in self.positions:
            raise gl.vm.UserError("POSITION_NOT_FOUND")
        pos = json.loads(self.positions[position_id])
        sender = str(gl.message.sender_address)
        if sender != pos["account"] and sender != self.owner:
            raise gl.vm.UserError("UNAUTHORIZED: only the position's account or the contract owner can resume it")
        if not pos.get("locked"):
            raise gl.vm.UserError("NOT_LOCKED: only a locked position can be resumed")

        pos["locked"] = False
        pos["status"] = "UNVERIFIED"
        pos["ai_sentiment"] = "N/A"
        pos["last_message"] = "POSITION_RESUMED: lock cleared -- status UNVERIFIED, NOT independently safe. Run a fresh check to reassess."
        self.positions[position_id] = json.dumps(pos)

        self._log_activity({
            "type": "RESUME_POSITION",
            "position_id": position_id,
            "account": pos["account"],
            "resumed_by": sender,
            "message": pos["last_message"],
        })
        return pos["last_message"]

    @gl.public.write
    def pause_protocol(self) -> str:
        """Owner-only emergency stop -- halts ALL checks until resume_protocol is called."""
        if str(gl.message.sender_address) != self.owner:
            raise gl.vm.UserError("ONLY_OWNER: only the deployer can pause the protocol")
        self.protocol_paused = True
        self._log_activity({
            "type": "PAUSE_PROTOCOL",
            "message": "PROTOCOL_PAUSED: emergency stop engaged by owner",
        })
        return "PROTOCOL_PAUSED: emergency stop engaged by owner"

    @gl.public.write
    def resume_protocol(self) -> str:
        if str(gl.message.sender_address) != self.owner:
            raise gl.vm.UserError("ONLY_OWNER: only the deployer can resume the protocol")
        self.protocol_paused = False
        self._log_activity({
            "type": "RESUME_PROTOCOL",
            "message": "PROTOCOL_RESUMED: emergency stop disengaged",
        })
        return "PROTOCOL_RESUMED: emergency stop disengaged"

    @gl.public.write
    def set_threshold(self, new_threshold: int) -> str:
        if str(gl.message.sender_address) != self.owner:
            raise gl.vm.UserError("ONLY_OWNER: only the deployer can change the threshold")
        if new_threshold < 1 or new_threshold > 1000:
            raise gl.vm.UserError("INVALID_THRESHOLD: threshold must be between 1 and 1000")
        self.global_threshold = new_threshold
        self._log_activity({
            "type": "SET_THRESHOLD",
            "new_threshold": new_threshold,
            "message": f"THRESHOLD_UPDATED: liquidation threshold is now {new_threshold}%",
        })
        return f"THRESHOLD_UPDATED: liquidation threshold is now {new_threshold}%"

    # -- views ------------------------------------------------------------
    @gl.public.view
    def get_position_status(self, position_id: str) -> str:
        if position_id not in self.positions:
            return "NOT_FOUND"
        return self.positions[position_id]

    @gl.public.view
    def get_all_positions(self) -> str:
        out = []
        count = int(self.position_count)
        for i in range(count):
            pid = self.position_index[bigint(i)]
            record = json.loads(self.positions[pid])
            record["position_id"] = pid
            out.append(record)
        return json.dumps(out)

    @gl.public.view
    def get_positions_for_account(self, account_address: str) -> str:
        if account_address not in self.account_positions:
            return "[]"
        out = []
        for pid in json.loads(self.account_positions[account_address]):
            record = json.loads(self.positions[pid])
            record["position_id"] = pid
            out.append(record)
        return json.dumps(out)

    @gl.public.view
    def get_check_history(self, limit: int) -> str:
        if limit <= 0 or limit > _MAX_HISTORY_LIMIT:
            limit = _MAX_HISTORY_LIMIT
        total = int(self.activity_count)
        start = max(1, total - limit + 1)
        out = []
        for i in range(start, total + 1):
            out.append(json.loads(self.check_history[bigint(i)]))
        return json.dumps(out)

    @gl.public.view
    def get_protocol_state(self) -> str:
        return json.dumps({
            "paused": self.protocol_paused,
            "threshold": str(self.global_threshold),
            "owner": self.owner,
            "total_checks": str(self.total_checks),
            "position_count": str(self.position_count),
            "contract_version": "v3.1",
            "position_origin": "USER_DECLARED_SIMULATION -- amounts are submitted by the registering wallet and are NOT verified against any lending protocol",
            "enforcement": "MONITORING_ONLY -- CollateralGuard never custodies funds; 'locked' is an on-chain risk flag on the record and does not restrict any external collateral or borrowing",
            "monitoring_mode": "MANUAL -- a check runs only when a user submits a check transaction; there is no automated keeper or continuous monitoring",
        })
