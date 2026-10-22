
from django.contrib import admin
from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "phone_number",
        "gender",
        "is_phone_verified",
        "trust_score",
        "created_at",
    )

    search_fields = (
        "user__username",
        "user__email",
        "phone_number",
    )

    list_filter = (
        "gender",
        "is_phone_verified",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )
