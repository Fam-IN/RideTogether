
from django.urls import path

from .views import (
    RideListCreateAPIView,
    RideRequestListCreateAPIView,
    RideRequestDecisionAPIView,
)

urlpatterns = [
    path(
        "rides/",
        RideListCreateAPIView.as_view(),
        name="api-rides",
    ),
    path(
        "ride-requests/",
        RideRequestListCreateAPIView.as_view(),
        name="api-ride-requests",
    ),
    path(
        "ride-requests/<int:pk>/decision/",
        RideRequestDecisionAPIView.as_view(),
        name="api-ride-request-decision",
    ),
]
