from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from rest_framework import generics, status
from rest_framework.permissions import (
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
)
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import RidePost, RideRequest
from .serializers import RidePostSerializer, RideRequestSerializer


class RideListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = RidePostSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = RidePost.objects.select_related("creator").filter(
            status=RidePost.Status.OPEN,
            departure_time__gt=timezone.now(),
        )

        pickup = self.request.query_params.get("pickup", "").strip()
        destination = self.request.query_params.get(
            "destination", ""
        ).strip()

        if pickup:
            queryset = queryset.filter(
                pickup_location__icontains=pickup
            )

        if destination:
            queryset = queryset.filter(
                destination__icontains=destination
            )

        return queryset


class RideRequestListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = RideRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = RideRequest.objects.select_related(
            "ride",
            "ride__creator",
            "requester",
        )

        user = self.request.user

        if not user.is_authenticated:
            return queryset.none()

        if self.request.query_params.get("incoming") == "1":
            return queryset.filter(
                ride__creator=user,
                status=RideRequest.Status.PENDING,
            ).order_by("-created_at")

        if self.request.query_params.get("mine") == "1":
            return queryset.filter(
                requester=user,
            ).order_by("-created_at")

        # Default: requests sent by this user OR requests
        # received on rides created by this user.
        return queryset.filter(
            Q(requester=user) | Q(ride__creator=user)
        ).distinct().order_by("-created_at")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            self.perform_create(serializer)
        except IntegrityError:
            return Response(
                {
                    "detail": (
                        "You have already requested this ride."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )

    def perform_create(self, serializer):
        serializer.save()


class RideRequestDecisionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        action = request.data.get("action", "")

        if isinstance(action, str):
            action = action.strip().lower()
        else:
            action = ""

        if action not in ("accept", "reject"):
            return Response(
                {
                    "detail": (
                        "Action must be 'accept' or 'reject'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                ride_request = (
                    RideRequest.objects
                    .select_for_update()
                    .select_related("ride")
                    .get(pk=pk)
                )

                if ride_request.ride.creator_id != request.user.id:
                    return Response(
                        {
                            "detail": (
                                "Only the ride creator can decide "
                                "this request."
                            )
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )

                if ride_request.status != RideRequest.Status.PENDING:
                    return Response(
                        {
                            "detail": (
                                "This request has already been decided."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if action == "reject":
                    ride_request.status = RideRequest.Status.REJECTED
                    ride_request.save(
                        update_fields=["status", "updated_at"]
                    )

                else:
                    ride = (
                        RidePost.objects
                        .select_for_update()
                        .get(pk=ride_request.ride_id)
                    )

                    if ride.departure_time <= timezone.now():
                        return Response(
                            {
                                "detail": (
                                    "This ride has already departed."
                                )
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    if ride.status != RidePost.Status.OPEN:
                        return Response(
                            {
                                "detail": "This ride is no longer open."
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    seats = ride_request.seats_requested

                    if seats < 1:
                        return Response(
                            {
                                "detail": (
                                    "The requested seat count is invalid."
                                )
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    if seats > ride.available_seats:
                        return Response(
                            {
                                "detail": "Not enough seats remain."
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    ride.available_seats -= seats

                    if ride.available_seats == 0:
                        ride.status = RidePost.Status.FULL

                    ride.save(
                        update_fields=[
                            "available_seats",
                            "status",
                            "updated_at",
                        ]
                    )

                    ride_request.status = RideRequest.Status.ACCEPTED
                    ride_request.save(
                        update_fields=["status", "updated_at"]
                    )

                result = RideRequestSerializer(
                    ride_request,
                    context={"request": request},
                ).data

            return Response(result, status=status.HTTP_200_OK)

        except RideRequest.DoesNotExist:
            return Response(
                {"detail": "Ride request not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        except RidePost.DoesNotExist:
            return Response(
                {"detail": "Ride not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
