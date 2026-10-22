from django.contrib import admin
from .models import RidePost, RideRequest


@admin.register(RidePost)
class RidePostAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "creator",
        "pickup_location",
        "destination",
        "departure_time",
        "vehicle_type",
        "available_seats",
        "status",
    )

    list_filter = ("status", "vehicle_type", "female_only")
    search_fields = (
        "pickup_location",
        "destination",
        "creator__username",
    )
    list_select_related = ("creator",)


@admin.register(RideRequest)
class RideRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "ride",
        "requester",
        "seats_requested",
        "status",
        "created_at",
    )

    list_filter = ("status",)
    search_fields = (
        "requester__username",
        "ride__pickup_location",
        "ride__destination",
    )
    list_select_related = ("ride", "requester")
