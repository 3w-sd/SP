# File: backend/api/permissions.py
from rest_framework import permissions

class IsAdmin(permissions.BasePermission):
    """Allows access only to Admin users."""
    def has_permission(self, request, view):
        # Check if user is authenticated and has the ADMIN role
        return request.user.is_authenticated and request.user.role == 'ADMIN'

class IsInstructor(permissions.BasePermission):
    """Allows access only to Instructor (Lecturer) users."""
    def has_permission(self, request, view):
        # Check if user is authenticated and has the LECTURER role
        return request.user.is_authenticated and request.user.role == 'LECTURER'

class IsStudent(permissions.BasePermission):
    """Allows access only to Student users."""
    def has_permission(self, request, view):
        # Check if user is authenticated and has the STUDENT role
        return request.user.is_authenticated and request.user.role == 'STUDENT'

class IsInstructorOfCourse(permissions.BasePermission):
    """
    Allows access only to the instructor assigned to the specific course, lecture, or attendance record.
    Checks object-level permissions.
    """
    def has_object_permission(self, request, view, obj):
        # Check if the object is a Course itself
        if hasattr(obj, 'instructor') and obj.instructor == request.user:
            return True
        # Check if the object (e.g., Lecture, Enrollment, Attendance) relates to a Course
        if hasattr(obj, 'course') and obj.course.instructor == request.user:
            return True
        return False

class IsStudentOwnerOfEnrollment(permissions.BasePermission):
    """
    Allows access only to the student who owns the specific enrollment record.
    Checks object-level permissions.
    """
    def has_object_permission(self, request, view, obj):
        # obj is expected to be an Enrollment instance
        return obj.student == request.user

class IsInstructorOfAttendance(permissions.BasePermission):
    """
    Allows instructors to manage attendance records specifically linked to their courses.
    Checks object-level permissions for Attendance records.
    """
    def has_object_permission(self, request, view, obj):
        # obj is expected to be an Attendance instance
        return obj.course.instructor == request.user

class IsStudentOwner(permissions.BasePermission):
    """
    Generic permission to check if the student owns the object (e.g., Attendance record).
    Checks object-level permissions.
    """
    def has_object_permission(self, request, view, obj):
        # obj could be Attendance, Enrollment, etc.
        # Ensure the object has a 'student' attribute before comparing
        return hasattr(obj, 'student') and obj.student == request.user