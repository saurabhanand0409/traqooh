"""Run Alembic migrations to the latest revision. Called once at start-up from main.py,
after the legacy create_all()/ALTERs. If a migration fails the app refuses to start,
so on Render the deploy fails and the previous version keeps serving."""
import logging
import os

from alembic import command
from alembic.config import Config

HERE = os.path.dirname(os.path.abspath(__file__))
logger = logging.getLogger(__name__)


def upgrade_to_head():
    cfg = Config(os.path.join(HERE, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(HERE, "migrations"))
    command.upgrade(cfg, "head")
    logger.info("Alembic migrations are at head")
