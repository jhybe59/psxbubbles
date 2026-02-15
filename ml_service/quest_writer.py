import psycopg2
import queue
import threading
import time
import structlog
from typing import Tuple, List

logger = structlog.get_logger()

class QuestDBWriter:
    """
    Fire-and-forget buffered writer for QuestDB.
    Uses a background thread to batch writes and prevent blocking the main inference loop.
    """
    def __init__(self, dsn: str, batch_size: int = 100):
        self.dsn = dsn
        self.queue = queue.Queue()
        self.batch_size = batch_size
        self.running = True
        
        # Start worker thread
        self.thread = threading.Thread(target=self._worker, daemon=True, name="QuestDBWriter")
        self.thread.start()
        
        logger.info("questdb_writer_started", batch_size=batch_size)

    def write(self, prediction: Tuple, features: Tuple):
        """
        Queue data for writing.
        prediction: (timestamp, symbol, prob)
        features: (timestamp, symbol, atr, vol)
        """
        self.queue.put((prediction, features))

    def stop(self):
        """Stop the writer cleanly."""
        self.running = False
        self.thread.join(timeout=5.0)
        logger.info("questdb_writer_stopped")

    def _worker(self):
        """Background worker loop."""
        conn = None
        cur = None
        
        # Reconnect logic
        while self.running:
            try:
                if conn is None or conn.closed:
                    conn = psycopg2.connect(self.dsn)
                    cur = conn.cursor()
                    logger.info("questdb_writer_connected")
            except Exception as e:
                logger.error("questdb_connection_error", error=str(e))
                time.sleep(5)
                continue

            batch_pred = []
            batch_feat = []

            try:
                # Try to fill batch or timeout
                start_time = time.time()
                while len(batch_pred) < self.batch_size:
                    # If we have items, use shorter timeout to flush periodically
                    timeout = 0.1 if batch_pred else 1.0
                    
                    try:
                        item = self.queue.get(timeout=timeout)
                        pred, feat = item
                        batch_pred.append(pred)
                        batch_feat.append(feat)
                    except queue.Empty:
                        # Flush if we have data and timed out
                        if batch_pred:
                            break
                        # If stopped and empty, exit
                        if not self.running:
                            return
                
                # Flush batch
                if batch_pred:
                    logger.debug("questdb_flush_attempt", rows_pred=len(batch_pred), rows_feat=len(batch_feat))
                    self._flush(cur, conn, batch_pred, batch_feat)
                    batch_pred.clear()
                    batch_feat.clear()
                    
            except Exception as e:
                logger.error("questdb_writer_error", error=str(e))
                # Force reconnect on error
                try:
                    if conn: conn.close()
                except:
                    pass
                conn = None

        # Final flush
        if conn and not conn.closed:
            conn.close()

    def _flush(self, cur, conn, preds: List[Tuple], feats: List[Tuple]):
        """Execute batch insert."""
        try:
            if preds:
                cur.executemany("""
                    INSERT INTO ml_predictions (
                        timestamp, symbol, action, signal_strength, confidence, regime, agents, start_price, prediction_probability
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, preds)
            
            if feats:
                cur.executemany("""
                    INSERT INTO market_features (timestamp, symbol, atr_14, volatility_20)
                    VALUES (%s, %s, %s, %s)
                """, feats)
            
            conn.commit()
            logger.info("questdb_flush_success", rows_pred=len(preds), rows_feat=len(feats))
            
        except Exception as e:
            logger.error("questdb_flush_failed", error=str(e))
            conn.rollback()
