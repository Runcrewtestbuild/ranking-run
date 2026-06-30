"""Background task: route thumbnail generation via Mapbox Static Images API.

Generates dark + light style thumbnails for runs and courses.
Uploads to S3 snapshots/ folder.
"""

import json
import logging
import urllib.parse
from uuid import UUID

import httpx
from geoalchemy2.shape import to_shape
from sqlalchemy import select

from app.core.config import get_settings
from app.core.storage import get_storage
from app.db.session import async_session_factory
from app.models.course import Course
from app.models.run_record import RunRecord

logger = logging.getLogger(__name__)

DARK_STYLE = "mapbox/dark-v11"
LIGHT_STYLE = "mapbox/outdoors-v12"
IMG_SIZE = 640


def _simplify(coords: list, max_pts: int = 80) -> list:
    if len(coords) <= max_pts:
        return coords
    step = (len(coords) - 1) / (max_pts - 1)
    result = [coords[int(i * step)] for i in range(max_pts - 1)]
    result.append(coords[-1])
    return result


def _build_url(coords: list, style: str, token: str) -> str | None:
    pts = _simplify(coords, 80)
    geojson = json.dumps({
        "type": "Feature",
        "properties": {"stroke": "#FFD600", "stroke-width": 5, "stroke-opacity": 1},
        "geometry": {
            "type": "LineString",
            "coordinates": [[round(c[0], 5), round(c[1], 5)] for c in pts],
        },
    }, separators=(",", ":"))
    encoded = urllib.parse.quote(geojson)
    url = (
        f"https://api.mapbox.com/styles/v1/{style}/static/"
        f"geojson({encoded})/auto/{IMG_SIZE}x{IMG_SIZE}@2x"
        f"?padding=60&logo=false&attribution=false&access_token={token}"
    )
    if len(url) > 8192:
        pts = _simplify(coords, 40)
        geojson = json.dumps({
            "type": "Feature",
            "properties": {"stroke": "#FFD600", "stroke-width": 5, "stroke-opacity": 1},
            "geometry": {
                "type": "LineString",
                "coordinates": [[round(c[0], 4), round(c[1], 4)] for c in pts],
            },
        }, separators=(",", ":"))
        encoded = urllib.parse.quote(geojson)
        url = (
            f"https://api.mapbox.com/styles/v1/{style}/static/"
            f"geojson({encoded})/auto/{IMG_SIZE}x{IMG_SIZE}@2x"
            f"?padding=60&logo=false&attribution=false&access_token={token}"
        )
    return url


async def _fetch_and_upload(url: str) -> str | None:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url)
    if resp.status_code != 200:
        logger.warning("Mapbox returned %d", resp.status_code)
        return None
    if len(resp.content) < 5000:
        return None
    storage = get_storage()
    return await storage.upload(data=resp.content, folder="snapshots", extension=".png")


def _extract_coords(geometry) -> list | None:
    try:
        shape = to_shape(geometry)
        coords = list(shape.coords)
        if len(coords) < 2:
            return None
        return [[c[0], c[1]] for c in coords]
    except Exception:
        return None


async def _generate_both(coords: list, token: str) -> tuple[str | None, str | None]:
    """Generate dark and light thumbnails, return (dark_url, light_url)."""
    dark_url = _build_url(coords, DARK_STYLE, token)
    light_url = _build_url(coords, LIGHT_STYLE, token)
    dark_s3 = await _fetch_and_upload(dark_url) if dark_url else None
    light_s3 = await _fetch_and_upload(light_url) if light_url else None
    return dark_s3, light_s3


async def generate_run_thumbnail(run_record_id: UUID) -> None:
    settings = get_settings()
    if not settings.MAPBOX_ACCESS_TOKEN:
        return
    try:
        async with async_session_factory() as db:
            result = await db.execute(select(RunRecord).where(RunRecord.id == run_record_id))
            record = result.scalar_one_or_none()
            if not record or not record.route_geometry:
                return
            coords = _extract_coords(record.route_geometry)
            if not coords:
                return
            dark_s3, light_s3 = await _generate_both(coords, settings.MAPBOX_ACCESS_TOKEN)
            if dark_s3:
                record.route_thumbnail_url = dark_s3
            if light_s3:
                record.route_thumbnail_url_light = light_s3
            await db.commit()
            logger.info("Thumbnails generated for run %s", run_record_id)
    except Exception:
        logger.exception("Failed to generate thumbnails for run %s", run_record_id)


async def generate_course_thumbnail(course_id: UUID) -> None:
    settings = get_settings()
    if not settings.MAPBOX_ACCESS_TOKEN:
        return
    try:
        async with async_session_factory() as db:
            result = await db.execute(select(Course).where(Course.id == course_id))
            course = result.scalar_one_or_none()
            if not course or not course.route_geometry:
                return
            coords = _extract_coords(course.route_geometry)
            if not coords:
                return
            dark_s3, light_s3 = await _generate_both(coords, settings.MAPBOX_ACCESS_TOKEN)
            if dark_s3:
                course.thumbnail_url = dark_s3
            if light_s3:
                course.thumbnail_url_light = light_s3
            await db.commit()
            logger.info("Thumbnails generated for course %s", course_id)
    except Exception:
        logger.exception("Failed to generate thumbnails for course %s", course_id)


async def backfill_thumbnails() -> dict:
    """Generate dark+light thumbnails for all runs/courses missing snapshots/."""
    settings = get_settings()
    if not settings.MAPBOX_ACCESS_TOKEN:
        return {"error": "MAPBOX_ACCESS_TOKEN not set"}

    stats = {"courses": 0, "runs": 0, "errors": 0}

    try:
        async with async_session_factory() as db:
            # Courses
            result = await db.execute(
                select(Course).where(
                    (Course.thumbnail_url.is_(None)) |
                    (~Course.thumbnail_url.contains("/snapshots/")) |
                    (Course.thumbnail_url_light.is_(None))
                )
            )
            for course in result.scalars().all():
                coords = _extract_coords(course.route_geometry) if course.route_geometry else None
                if not coords:
                    continue
                try:
                    dark_s3, light_s3 = await _generate_both(coords, settings.MAPBOX_ACCESS_TOKEN)
                    if dark_s3:
                        course.thumbnail_url = dark_s3
                    if light_s3:
                        course.thumbnail_url_light = light_s3
                    stats["courses"] += 1
                except Exception:
                    stats["errors"] += 1
            await db.commit()

            # Runs
            result = await db.execute(
                select(RunRecord).where(
                    (RunRecord.route_thumbnail_url.is_(None)) |
                    (~RunRecord.route_thumbnail_url.contains("/snapshots/")) |
                    (RunRecord.route_thumbnail_url_light.is_(None))
                )
            )
            for record in result.scalars().all():
                coords = _extract_coords(record.route_geometry) if record.route_geometry else None
                if not coords:
                    continue
                try:
                    dark_s3, light_s3 = await _generate_both(coords, settings.MAPBOX_ACCESS_TOKEN)
                    if dark_s3:
                        record.route_thumbnail_url = dark_s3
                    if light_s3:
                        record.route_thumbnail_url_light = light_s3
                    stats["runs"] += 1
                except Exception:
                    stats["errors"] += 1
            await db.commit()

    except Exception:
        logger.exception("Backfill failed")
        stats["errors"] += 1

    logger.info("Backfill complete: %s", stats)
    return stats
