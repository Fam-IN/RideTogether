from rest_framework import serializers

from .models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    email = serializers.EmailField(
        source="user.email",
        read_only=True,
    )

    profile_image = serializers.ImageField(
        required=False,
        allow_null=True,
    )

    class Meta:
        model = UserProfile
        fields = [
            "username",
            "email",
            "profile_image",
            "phone_number",
            "gender",
            "is_phone_verified",
            "trust_score",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "username",
            "email",
            "is_phone_verified",
            "trust_score",
            "created_at",
            "updated_at",
        ]

    def validate_profile_image(self, value):
        if value and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError(
                "Profile photo must be 5 MB or smaller."
            )

        return value

    def validate_phone_number(self, value):
        return value.strip()

    def validate_gender(self, value):
        valid_values = {
            "",
            "MALE",
            "FEMALE",
            "OTHER",
            "UNDISCLOSED",
        }

        if value not in valid_values:
            raise serializers.ValidationError(
                "Select a valid gender option."
            )

        return value
