from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class RidePost(models.Model):
    class VehicleType(models.TextChoices):
        CAR = "CAR", "Car"
        CNG = "CNG", "CNG"
        BIKE = "BIKE", "Bike"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        FULL = "FULL", "Full"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_rides",
    )

    pickup_location = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)

    departure_time = models.DateTimeField()

    vehicle_type = models.CharField(
        max_length=10,
        choices=VehicleType.choices,
        default=VehicleType.CAR,
    )

    total_seats = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1)],
    )

    available_seats = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0)],
    )

    cost_per_seat = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    female_only = models.BooleanField(default=False)

    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.OPEN,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["departure_time"]

    def __str__(self):
        return (
            f"{self.pickup_location} to {self.destination} "
            f"({self.departure_time:%Y-%m-%d %H:%M})"
        )

    def save(self, *args, **kwargs):
        if self.available_seats > self.total_seats:
            raise ValueError(
                "Available seats cannot exceed total seats."
            )
        super().save(*args, **kwargs)


class RideRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"

    ride = models.ForeignKey(
        RidePost,
        on_delete=models.CASCADE,
        related_name="ride_requests",
    )

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ride_requests",
    )

    seats_requested = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
    )

    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["ride", "requester"],
                name="unique_request_per_ride_user",
            ),
        ]

    def __str__(self):
        return (
            f"{self.requester} - {self.ride} "
            f"({self.status})"
        )
