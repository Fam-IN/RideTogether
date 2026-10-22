from django.utils import timezone
from rest_framework import serializers

from .models import RidePost, RideRequest


class RidePostSerializer(serializers.ModelSerializer):
    creator_username = serializers.CharField(
        source="creator.username",
        read_only=True,
    )

    class Meta:
        model = RidePost
        fields = [
            "id",
            "creator",
            "creator_username",
            "pickup_location",
            "destination",
            "departure_time",
            "vehicle_type",
            "total_seats",
            "available_seats",
            "cost_per_seat",
            "female_only",
            "status",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "creator",
            "available_seats",
            "status",
            "created_at",
        ]

    def validate_departure_time(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError(
                "Departure time must be in the future."
            )
        return value

    def validate_total_seats(self, value):
        if value < 1:
            raise serializers.ValidationError(
                "At least one seat is required."
            )
        return value

    def create(self, validated_data):
        validated_data["creator"] = self.context["request"].user
        validated_data["available_seats"] = validated_data["total_seats"]
        return super().create(validated_data)


class RideRequestSerializer(serializers.ModelSerializer):
    requester_username = serializers.CharField(
        source="requester.username",
        read_only=True,
    )
    ride_details = RidePostSerializer(source="ride", read_only=True)

    class Meta:
        model = RideRequest
        fields = [
            "id",
            "ride",
            "ride_details",
            "requester",
            "requester_username",
            "seats_requested",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "requester",
            "status",
            "created_at",
            "updated_at",
        ]

    def validate_seats_requested(self, value):
        if value < 1:
            raise serializers.ValidationError(
                "You must request at least one seat."
            )
        return value

    def validate(self, attrs):
        ride = attrs["ride"]
        user = self.context["request"].user

        if ride.creator_id == user.id:
            raise serializers.ValidationError(
                "You cannot request your own ride."
            )

        if ride.status != RidePost.Status.OPEN:
            raise serializers.ValidationError(
                "This ride is not open for requests."
            )

        if ride.departure_time <= timezone.now():
            raise serializers.ValidationError(
                "This ride has already departed."
            )

        if attrs["seats_requested"] > ride.available_seats:
            raise serializers.ValidationError(
                "Not enough seats are currently available."
            )

        if RideRequest.objects.filter(
            ride=ride,
            requester=user,
        ).exists():
            raise serializers.ValidationError(
                "You have already requested this ride."
            )

        return attrs

    def create(self, validated_data):
        validated_data["requester"] = self.context["request"].user
        return super().create(validated_data)
