"""
Data Export Module
Exports historical data from QuestDB to Parquet/CSV/DataFrame.
"""
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Literal
import pandas as pd
import structlog
from sqlalchemy import create_engine, text

from config import settings

logger = structlog.get_logger()


class DataExporter:
    """Export historical tick and bar data from QuestDB."""
    
    def __init__(self, output_dir: str = "./data"):
        self.engine = create_engine(settings.questdb_dsn)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def export_ticks(
        self,
        symbol: str,
        start: datetime,
        end: datetime,
        table: str = "trades",
        format: Literal["parquet", "csv", "dataframe"] = "parquet"
    ) -> Optional[pd.DataFrame]:
        """
        Export raw tick/trade data.
        
        Args:
            symbol: Symbol to export
            start: Start datetime
            end: End datetime
            table: Source table name
            format: Output format
            
        Returns:
            DataFrame if format='dataframe', else None (writes to file)
        """
        query = text(f"""
            SELECT 
                timestamp,
                symbol,
                price,
                volume
            FROM {table}
            WHERE symbol = :symbol
              AND timestamp >= :start
              AND timestamp < :end
            ORDER BY timestamp ASC
        """)
        
        logger.info("exporting_ticks", symbol=symbol, start=start, end=end)
        
        with self.engine.connect() as conn:
            df = pd.read_sql(query, conn, params={
                "symbol": symbol,
                "start": start,
                "end": end
            })
        
        if df.empty:
            logger.warning("no_ticks_found", symbol=symbol)
            return None if format == "dataframe" else None
        
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp').reset_index(drop=True)
        
        logger.info("ticks_fetched", symbol=symbol, rows=len(df))
        
        if format == "dataframe":
            return df
        
        # Write to file
        filename = f"ticks_{symbol}_{start.strftime('%Y%m%d')}_{end.strftime('%Y%m%d')}"
        if format == "parquet":
            path = self.output_dir / f"{filename}.parquet"
            df.to_parquet(path, index=False)
        else:
            path = self.output_dir / f"{filename}.csv"
            df.to_csv(path, index=False)
        
        logger.info("ticks_exported", path=str(path), rows=len(df))
        return None
    
    def export_bars(
        self,
        symbol: str,
        start: datetime,
        end: datetime,
        table: str = "minute_bars",
        format: Literal["parquet", "csv", "dataframe"] = "parquet"
    ) -> Optional[pd.DataFrame]:
        """
        Export OHLCV bar data.
        """
        query = text(f"""
            SELECT 
                timestamp,
                symbol,
                open,
                high,
                low,
                close,
                volume
            FROM {table}
            WHERE symbol = :symbol
              AND timestamp >= :start
              AND timestamp < :end
            ORDER BY timestamp ASC
        """)
        
        logger.info("exporting_bars", symbol=symbol, start=start, end=end)
        
        with self.engine.connect() as conn:
            df = pd.read_sql(query, conn, params={
                "symbol": symbol,
                "start": start,
                "end": end
            })
        
        if df.empty:
            logger.warning("no_bars_found", symbol=symbol)
            return None if format == "dataframe" else None
        
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp').reset_index(drop=True)
        
        if format == "dataframe":
            return df
        
        filename = f"bars_{symbol}_{start.strftime('%Y%m%d')}_{end.strftime('%Y%m%d')}"
        if format == "parquet":
            path = self.output_dir / f"{filename}.parquet"
            df.to_parquet(path, index=False)
        else:
            path = self.output_dir / f"{filename}.csv"
            df.to_csv(path, index=False)
        
        logger.info("bars_exported", path=str(path), rows=len(df))
        return None
    
    def export_multi_symbol(
        self,
        symbols: list[str],
        start: datetime,
        end: datetime,
        data_type: Literal["ticks", "bars"] = "bars",
        format: Literal["parquet", "csv"] = "parquet"
    ) -> Path:
        """
        Export multiple symbols into a single combined file.
        
        Returns:
            Path to the combined output file
        """
        all_data = []
        
        for symbol in symbols:
            if data_type == "ticks":
                df = self.export_ticks(symbol, start, end, format="dataframe")
            else:
                df = self.export_bars(symbol, start, end, format="dataframe")
            
            if df is not None:
                all_data.append(df)
        
        if not all_data:
            raise ValueError("No data found for any symbol")
        
        combined = pd.concat(all_data, ignore_index=True)
        combined = combined.sort_values(['timestamp', 'symbol']).reset_index(drop=True)
        
        filename = f"{data_type}_combined_{start.strftime('%Y%m%d')}_{end.strftime('%Y%m%d')}"
        if format == "parquet":
            path = self.output_dir / f"{filename}.parquet"
            combined.to_parquet(path, index=False)
        else:
            path = self.output_dir / f"{filename}.csv"
            combined.to_csv(path, index=False)
        
        logger.info("multi_symbol_exported", 
                    path=str(path), 
                    symbols=len(symbols), 
                    rows=len(combined))
        return path
    
    def get_available_symbols(self, table: str = "minute_bars") -> list[str]:
        """Get list of symbols available in the database."""
        query = text(f"SELECT DISTINCT symbol FROM {table} ORDER BY symbol")
        with self.engine.connect() as conn:
            result = conn.execute(query)
            return [row[0] for row in result]
    
    def get_date_range(self, symbol: str, table: str = "minute_bars") -> tuple[datetime, datetime]:
        """Get available date range for a symbol."""
        query = text(f"""
            SELECT MIN(timestamp) as min_ts, MAX(timestamp) as max_ts
            FROM {table}
            WHERE symbol = :symbol
        """)
        with self.engine.connect() as conn:
            result = conn.execute(query, {"symbol": symbol}).fetchone()
            return result[0], result[1]


# CLI interface
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Export data from QuestDB")
    parser.add_argument("--symbol", required=True, help="Symbol to export")
    parser.add_argument("--days", type=int, default=30, help="Days of history")
    parser.add_argument("--type", choices=["ticks", "bars"], default="bars")
    parser.add_argument("--format", choices=["parquet", "csv"], default="parquet")
    parser.add_argument("--output", default="./data")
    args = parser.parse_args()
    
    exporter = DataExporter(output_dir=args.output)
    end = datetime.now()
    start = end - timedelta(days=args.days)
    
    if args.type == "ticks":
        exporter.export_ticks(args.symbol, start, end, format=args.format)
    else:
        exporter.export_bars(args.symbol, start, end, format=args.format)
