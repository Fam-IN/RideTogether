from django.db.models import Q
from rest_framework import generics
from rest_framework.permissions import IsAuthenticatedOrReadOnly

from .models import Review
from .serializers import ReviewSerializer


class ReviewListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Review.objects.select_related(
            "ride",
            "reviewer",
            "reviewee",
        )

        ride_id = self.request.query_params.get("ride")
        reviewee_id = self.request.query_params.get("reviewee")

        if self.request.query_params.get("mine") == "1":
            if not self.request.user.is_authenticated:
                return queryset.none()
            queryset = queryset.filter(
                Q(reviewer=self.request.user) |
                Q(reviewee=self.request.user)
            )
        elif not ride_id and not reviewee_id:
            # Avoid returning every review unless the client asks for a scope.
            return queryset.none()

        if ride_id:
            queryset = queryset.filter(ride_id=ride_id)
        if reviewee_id:
            queryset = queryset.filter(reviewee_id=reviewee_id)

        return queryset.order_by("-created_at")
