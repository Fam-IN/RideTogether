from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator

from rest_framework import generics
from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import (
    JSONParser,
    FormParser,
    MultiPartParser,
)
from rest_framework.permissions import IsAuthenticated

from .models import UserProfile
from .serializers import UserProfileSerializer


@method_decorator(login_required, name="dispatch")
class UserProfileAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [SessionAuthentication]

    parser_classes = [
        JSONParser,
        FormParser,
        MultiPartParser,
    ]

    http_method_names = [
        "get",
        "patch",
        "head",
        "options",
    ]

    def get_object(self):
        profile, _ = UserProfile.objects.get_or_create(
            user=self.request.user
        )
        return profile
