"""Baseline: the schema as of 2026-10-04.

Everything up to this point was created by models.Base.metadata.create_all() plus the
hand-written ALTERs in main.run_migrations(). This revision changes nothing; it marks the
starting point so later migrations are tracked and run exactly once.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-10-04
"""

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
