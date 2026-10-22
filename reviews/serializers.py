from django.utils import timezone
from rest_framework import serializers

from rides.models import RidePost, RideRequest
from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    reviewer_username = serializers.CharField(
        source="reviewer.username",
        read_only=True,
    )
    reviewee_username = serializers.CharField(
        source="reviewee.username",
        read_only=True,
    )

    class Meta:
        model = Review
        fields = [
            "id",
            "ride",
            "reviewer_username",
            "reviewee",
            "reviewee_username",
            "rating",
            "comment",
            "created_at",
        ]
        read_only_fields = ["id", "reviewer_username", "reviewee_username", "created_at"]

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be between 1 and 5 stars.")
        return value

    def validate_comment(self, value):
        value = value.strip()
        if len(value) > 1000:
            raise serializers.ValidationError("Review must be 1000 characters or fewer.")
        return value

    def validate(self, attrs):
        request = self.context["request"]
        reviewer = request.user
        ride = attrs["ride"]
        reviewee = attrs["reviewee"]

        if reviewer.pk == reviewee.pk:
            raise serializers.ValidationError("You cannot review yourself.")

        if ride.departure_time > timezone.now():
            raise serializers.ValidationError(
                "You can leave a review after the ride departure time has passed."
            )

        if reviewer.pk == ride.creator_id:
            eligible = RideRequest.objects.filter(
                ride=ride,
                requester=reviewee,
                status=RideRequest.Status.ACCEPTED,
            ).exists()
            if not eligible:
                raise serializers.ValidationError(
                    "You can review only a passenger whose request was accepted for this ride."
                )
        else:
            own_accepted_request = RideRequest.objects.filter(
                ride=ride,
                requester=reviewer,
                status=RideRequest.Status.ACCEPTED,
            ).exists()
            if not own_accepted_request or reviewee.pk != ride.creator_id:
                raise serializers.ValidationError(
                    "You can review the creator only after your request for this ride was accepted."
                )

        if Review.objects.filter(
            ride=ride,
            reviewer=reviewer,
            reviewee=reviewee,
        ).exists():
            raise serializers.ValidationError(
                "You have already reviewed this person for this ride."
            )

        return attrs

    def create(self, validated_data):
        validated_data["reviewer"] = self.context["request"].user
        return super().create(validated_data)
