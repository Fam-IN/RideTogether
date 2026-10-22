
from django.urls import path

from . import views
from .api_views import UserProfileAPIView


urlpatterns = [
    path("", views.home_view, name="home"),
    path("register/", views.register_view, name="register"),
    path("login/", views.login_view, name="login"),
    path("profile/", views.profile_view, name="profile"),
    path("logout/", views.logout_view, name="logout"),

    # React Profile API
    path(
        "api/profile/",
        UserProfileAPIView.as_view(),
        name="api-profile",
    ),
]
