"""Background task: update user and course statistics after a run."""

import logging
from uuid import UUID

from sqlalchemy import select, update

from app.core.config import get_settings
from app.db.session import async_session_factory
from app.models.user import User
from app.models.crew import Crew
from app.models.crew import CrewMember
from app.core.runner_level_config import calc_runner_level
from app.services.notification_service import NotificationService
from app.services.stats_service import StatsService

logger = logging.getLogger(__name__)

# Crew level thresholds in meters of cumulative XP
CREW_LEVEL_THRESHOLDS = [
    0, 100_000, 500_000, 1_500_000, 5_000_000,
    15_000_000, 50_000_000, 150_000_000, 500_000_000, 1_000_000_000,
]


def calc_crew_level(total_xp: int) -> int:
    """Calculate crew level from cumulative XP (distance in meters)."""
    for i in range(len(CREW_LEVEL_THRESHOLDS) - 1, -1, -1):
        if total_xp >= CREW_LEVEL_THRESHOLDS[i]:
            return i + 1
    return 1


async def update_stats_after_run(
    user_id: UUID,
    run_record_id: UUID,
    course_id: UUID | None,
    distance_meters: int,
) -> None:
    """Update user cumulative stats and course stats after a run completes.

    This runs as a FastAPI BackgroundTask to avoid blocking the response.

    Args:
        user_id: The runner.
        run_record_id: The completed run record.
        course_id: The course (None for free runs).
        distance_meters: Distance of the completed run.
    """
    logger.info(
        "Updating stats: user=%s, run=%s, course=%s, distance=%d",
        user_id,
        run_record_id,
        course_id,
        distance_meters,
    )

    try:
        stats_service = StatsService()

        async with async_session_factory() as db:
            await stats_service.update_user_cumulative_stats(
                db, user_id, distance_meters, course_id, run_record_id=run_record_id,
            )

            if course_id is not None:
                await stats_service.update_course_stats(db, course_id)

            # Update runner level
            user = await db.get(User, user_id)
            if user is not None:
                new_level = calc_runner_level(user.total_distance_meters)
                if new_level != user.runner_level:
                    old_level = user.runner_level
                    logger.info("Runner level up: user=%s, %d → %d", user_id, old_level, new_level)
                    user.runner_level = new_level

                    # Send level up notification
                    if new_level > old_level:
                        try:
                            notification_svc = NotificationService(get_settings())
                            await notification_svc.create_and_send(
                                db=db,
                                user_id=user_id,
                                notification_type="level_up",
                                actor_id=user_id,
                                title="레벨 업!",
                                body=f"레벨 {new_level}에 도달했습니다!",
                                target_id=str(user_id),
                                target_type="user",
                            )
                        except Exception:
                            logger.warning("Failed to send level_up notification for user %s", user_id)

            # Check weekly goal achievement
            if user is not None:
                try:
                    weekly_stats = await stats_service.get_weekly_stats(db, user_id)
                    weekly_distance_km = weekly_stats["total_distance_meters"] / 1000
                    weekly_goal_km = user.weekly_goal_km or 20.0
                    # Check if this run pushed user past the goal
                    prev_distance_km = (weekly_stats["total_distance_meters"] - distance_meters) / 1000
                    if weekly_distance_km >= weekly_goal_km > prev_distance_km:
                        notification_svc = NotificationService(get_settings())
                        await notification_svc.create_and_send(
                            db=db,
                            user_id=user_id,
                            notification_type="weekly_goal",
                            actor_id=user_id,
                            title="주간 목표 달성!",
                            body="이번 주 목표를 달성했습니다!",
                            target_id=str(user_id),
                            target_type="user",
                        )
                except Exception:
                    logger.warning("Failed to check/send weekly_goal notification for user %s", user_id)

            # Update crew XP for all crews the user belongs to
            crew_result = await db.execute(
                select(CrewMember.crew_id).where(CrewMember.user_id == user_id)
            )
            crew_ids = [row[0] for row in crew_result.all()]
            for cid in crew_ids:
                await db.execute(
                    update(Crew).where(Crew.id == cid).values(
                        total_xp=Crew.total_xp + distance_meters
                    )
                )
                # Refresh to recalculate level from updated XP
                crew = await db.get(Crew, cid)
                if crew is not None:
                    crew.level = calc_crew_level(crew.total_xp)

            await db.commit()
            logger.info("Stats updated successfully for run %s", run_record_id)

    except Exception:
        logger.exception("Failed to update stats for run %s", run_record_id)
