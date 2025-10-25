# File: backend/api/permissions.py
from rest_framework import permissions

class IsAdmin(permissions.BasePermission):
    """Allows access only to Admin users."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'ADMIN'

class IsInstructor(permissions.BasePermission):
    """Allows access only to Instructor (Lecturer) users."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'LECTURER'

class IsStudent(permissions.BasePermission):
    """Allows access only to Student users."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'STUDENT'

class IsInstructorOfCourse(permissions.BasePermission):
    """
    Allows access only to the instructor of the course.
    Assumes the view has a 'course' object.
    """
    def has_object_permission(self, request, view, obj):
        # obj is the Course instance
        return obj.instructor == request.user

class IsStudentOwnerOfEnrollment(permissions.BasePermission):
    """
    Allows access only to the student who owns the enrollment.
    Assumes the view has an 'enrollment' object.
    """
    def has_object_permission(self, request, view, obj):
        # obj is the Enrollment instance
        return obj.student == request.user