# File: backend/api/views.py
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError, NotFound
from rest_framework_simplejwt.views import TokenObtainPairView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from django.db.models import Count, Q
from datetime import date
from django.db.models.functions import ExtractDay, ExtractMonth, ExtractYear
from django.utils import timezone
from django.conf import settings
from django.db.utils import IntegrityError
import traceback

from .serializers import (
    UserSerializer,
    CustomTokenObtainPairSerializer,
    DepartmentSerializer,
    CourseSerializer,
    CourseCreateUpdateSerializer,
    EnrollmentSerializer,
    EnrollmentCreateSerializer,
    LectureSerializer,
    AttendanceSerializer,
    AttendanceMarkSerializer,
    ManualAttendanceSerializer,
)
from .models import User, Department, Course, Enrollment, Attendance, Lecture
from .permissions import IsAdmin, IsInstructor, IsStudent, IsInstructorOfCourse, IsStudentOwnerOfEnrollment, IsInstructorOfAttendance, IsStudentOwner
from .utils import calculate_distance, generate_random_pin, is_within_time_window

# --- AUTH VIEWS ---
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class UserRegistrationView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]

class UserProfileView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        if not self.request.user.is_authenticated:
            raise permissions.NotAuthenticated()
        return self.request.user

class UserListView(generics.ListAPIView):
    queryset = User.objects.all().order_by('last_name')
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ['role']

# --- CORE DATA VIEWSETS ---

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            self.permission_classes = [IsAdmin]
        return super().get_permissions()

class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all().select_related('department', 'instructor').prefetch_related('enrollments', 'lectures')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['department', 'instructor', 'credits']
    search_fields = ['name', 'code']
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return CourseCreateUpdateSerializer
        return CourseSerializer

    def get_permissions(self):
        if self.action == 'create':
            self.permission_classes = [IsAdmin | IsInstructor]
        elif self.action in ['update', 'partial_update', 'destroy', 'students', 'attendance_report']: # Added report
            pass # Handled by check_object_permissions
        return super().get_permissions()

    def check_object_permissions(self, request, obj):
        if request.method in permissions.SAFE_METHODS:
            # Safe methods (GET) are allowed for all authenticated users
            return

        # Deny modification/custom actions unless Admin or Instructor Owner
        super().check_object_permissions(request, obj)
        if request.user.role == 'ADMIN':
            return
        if request.user.role == 'LECTURER' and obj.instructor == request.user:
            return
        
        self.permission_denied(
            request, message='You do not have permission to perform this action on this course.'
        )

    def perform_create(self, serializer):
        if self.request.user.role == 'LECTURER' and not serializer.validated_data.get('instructor'):
            serializer.save(instructor=self.request.user)
        else:
            serializer.save()

    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        course = self.get_object()
        enrollments = Enrollment.objects.filter(course=course, status__in=['ENROLLED', 'COMPLETED']).select_related('student')
        serializer = EnrollmentSerializer(enrollments, many=True)
        return Response(serializer.data)

    # --- ACTION MOVED HERE ---
    @action(detail=True, methods=['get'], url_path='attendance-report')
    def reports_course(self, request, pk=None):
        """Generates attendance report for this specific course (pk)."""
        course = self.get_object() # Gets the course, permissions are checked by check_object_permissions
        
        total_sessions = course.lectures.count()

        student_stats = User.objects.filter(enrollments__course=course, enrollments__status='ENROLLED').annotate(
            present_count=Count('attendance_records', filter=Q(attendance_records__course=course, attendance_records__status='PRESENT')),
            absent_count=Count('attendance_records', filter=Q(attendance_records__course=course, attendance_records__status='ABSENT')),
            late_count=Count('attendance_records', filter=Q(attendance_records__course=course, attendance_records__status='LATE')),
        ).values('id', 'first_name', 'last_name', 'present_count', 'absent_count', 'late_count')

        report = {
            "course": course.name,
            "course_code": course.code,
            "total_sessions_tracked": total_sessions,
            "student_summary": [
                {
                    "student_id": stat['id'],
                    "name": f"{stat['first_name']} {stat['last_name']}",
                    "present": stat['present_count'],
                    "absent": stat['absent_count'],
                    "late": stat['late_count'],
                    "attendance_percentage": f"{ (stat['present_count'] / total_sessions * 100):.2f}%" if total_sessions > 0 else "N/A"
                } for stat in student_stats
            ]
        }
        return Response(report)


class EnrollmentViewSet(viewsets.ModelViewSet):
    # ... (EnrollmentViewSet remains the same) ...
    queryset = Enrollment.objects.all().select_related('student', 'course')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return EnrollmentCreateSerializer
        return EnrollmentSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return Enrollment.objects.all().select_related('student', 'course', 'course__instructor')
        if user.role == 'LECTURER':
            return Enrollment.objects.filter(course__instructor=user).select_related('student', 'course')
        if user.role == 'STUDENT':
            return Enrollment.objects.filter(student=user).select_related('student', 'course')
        return Enrollment.objects.none()

    def get_permissions(self):
        if self.action == 'create':
            self.permission_classes = [IsStudent]
        elif self.action in ['update', 'partial_update', 'destroy']:
            pass
        return super().get_permissions()

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.user.role == 'STUDENT' and obj.student == request.user:
            return
        if request.user.role == 'ADMIN':
            return
        self.permission_denied(
            request, message='You do not have permission to modify this enrollment.'
        )

    @action(detail=False, methods=['get'], url_path='my-courses')
    def my_courses(self, request):
        if request.user.role != 'STUDENT':
            raise PermissionDenied("Only students can access this view.")

        enrollments = Enrollment.objects.filter(student=request.user).select_related('course', 'course__department', 'course__instructor')
        serializer = self.get_serializer(enrollments, many=True)
        return Response(serializer.data)


# --- LECTURE VIEWSET ---
class LectureViewSet(viewsets.ModelViewSet):
    # ... (LectureViewSet remains the same) ...
    queryset = Lecture.objects.all().select_related('course', 'course__instructor')
    serializer_class = LectureSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        course_id = self.request.query_params.get('course')
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        return queryset

    def get_permissions(self):
        if self.action == 'create':
            self.permission_classes = [IsAdmin | IsInstructor]
        elif self.action in ['update', 'partial_update', 'destroy', 'generate_pin']:
            pass
        return super().get_permissions()

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.user.role == 'ADMIN':
            return
        if request.user.role == 'LECTURER' and obj.course.instructor == request.user:
            return
        self.permission_denied(
            request, message='You do not have permission to modify this lecture.'
        )

    def perform_create(self, serializer):
        course = serializer.validated_data.get('course')
        if self.request.user.role == 'LECTURER' and course.instructor != self.request.user:
            raise PermissionDenied("You can only schedule lectures for courses you teach.")
        serializer.save()

    @action(detail=True, methods=['post'])
    def generate_pin(self, request, pk=None):
        lecture = self.get_object() 
        if lecture.is_pin_active():
            return Response({"detail": "PIN is still active.", "pin": lecture.attendance_pin}, status=status.HTTP_200_OK)
        new_pin = generate_random_pin()
        lecture.attendance_pin = new_pin
        lecture.pin_generated_at = timezone.now()
        lecture.save(update_fields=['attendance_pin', 'pin_generated_at'])
        return Response({"detail": "New PIN generated.", "pin": new_pin}, status=status.HTTP_200_OK)


# --- ATTENDANCE VIEWSET ---
class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.all().select_related('student', 'course', 'lecture')
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # ... (get_queryset remains the same) ...
        user = self.request.user
        if user.role == 'ADMIN':
            return Attendance.objects.all()
        if user.role == 'LECTURER':
            return Attendance.objects.filter(course__instructor=user)
        if user.role == 'STUDENT':
            return Attendance.objects.filter(student=user)
        return Attendance.objects.none()

    def get_permissions(self):
        if self.action == 'mark':
            self.permission_classes = [IsStudent]
        elif self.action == 'manual_mark':
            self.permission_classes = [IsInstructor | IsAdmin]
        # --- ACTION REMOVED FROM HERE ---
        # elif self.action == 'reports_course':
        #     self.permission_classes = [IsInstructor | IsAdmin]
        elif self.action in ['update', 'partial_update', 'destroy']:
            pass
        return super().get_permissions()

    def check_object_permissions(self, request, obj):
        # ... (check_object_permissions remains the same) ...
        super().check_object_permissions(request, obj)
        if request.user.role == 'ADMIN':
            return
        if request.user.role == 'LECTURER' and obj.course.instructor == request.user:
            return
        self.permission_denied(
            request, message='You do not have permission to modify this attendance record.'
        )

    @action(detail=False, methods=['post'], serializer_class=AttendanceMarkSerializer)
    def mark(self, request):
        # ... (mark logic remains the same) ...
        user = request.user
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except ValidationError as e:
            print(f"--- ATTENDANCE VALIDATION ERROR ---\nUser: {user.email}\nData: {request.data}\nError: {e.detail}\n----------------------------------\n")
            raise e
        lecture = serializer.validated_data['lecture']
        student_lat = serializer.validated_data.get('latitude')
        student_lon = serializer.validated_data.get('longitude')
        submitted_pin = serializer.validated_data.get('attendance_pin')
        if not Enrollment.objects.filter(student=user, course=lecture.course, status='ENROLLED').exists():
            return Response({"detail": "You are not enrolled in this course."}, status=status.HTTP_403_FORBIDDEN)
        if not is_within_time_window(lecture.start_time, lecture.end_time, lecture.timezone):
             return Response({"detail": "Attendance window is closed."}, status=status.HTTP_400_BAD_REQUEST)
        status_to_mark = 'ABSENT'
        is_valid = False
        if submitted_pin and user.master_pin and user.master_pin == submitted_pin and user.role == 'ADMIN':
            status_to_mark = 'PRESENT'
            is_valid = True
        elif submitted_pin and lecture.attendance_pin and lecture.attendance_pin == submitted_pin and lecture.is_pin_active():
            status_to_mark = 'PRESENT'
            is_valid = True
        elif student_lat and student_lon:
            if lecture.location_lat is None or lecture.location_lon is None:
                 return Response({"detail": "Lecture location is not set for attendance check."}, status=status.HTTP_400_BAD_REQUEST)
            course_lat = float(lecture.location_lat)
            course_lon = float(lecture.location_lon)
            radius = lecture.attendance_radius
            distance = calculate_distance(float(student_lat), float(student_lon), course_lat, course_lon)
            if distance <= radius:
                status_to_mark = 'PRESENT'
                is_valid = True
            else:
                return Response({"detail": f"Location check failed. You are {distance:.2f} meters away (Limit: {radius}m)."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"detail": "Missing PIN or Location data, or PIN is invalid/expired."}, status=status.HTTP_400_BAD_REQUEST)
        if is_valid:
            try:
                Attendance.objects.create(
                    student=user, course=lecture.course, lecture=lecture, status=status_to_mark,
                    latitude=student_lat if status_to_mark == 'PRESENT' else None,
                    longitude=student_lon if status_to_mark == 'PRESENT' else None
                )
                return Response({"detail": f"Attendance marked successfully ({status_to_mark})."}, status=status.HTTP_201_CREATED)
            except IntegrityError:
                return Response({"detail": "Attendance already marked for this lecture session."}, status=status.HTTP_400_BAD_REQUEST)
        else:
             return Response({"detail": "Attendance validation failed."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='manual-mark', serializer_class=ManualAttendanceSerializer)
    def manual_mark(self, request):
        # ... (manual_mark logic remains the same) ...
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except ValidationError as e:
            print(f"--- MANUAL ATTENDANCE VALIDATION ERROR ---\nInstructor: {request.user.email}\nData: {request.data}\nError: {e.detail}\n----------------------------------------\n")
            raise e
        lecture = serializer.validated_data['lecture']
        student = serializer.validated_data['student']
        status_value = serializer.validated_data['status']
        if not (request.user.role == 'ADMIN' or (request.user.role == 'LECTURER' and lecture.course.instructor == request.user)):
             raise PermissionDenied("You can only mark attendance for your own courses or if you are an Admin.")
        try:
            Attendance.objects.create(student=student, course=lecture.course, lecture=lecture, status=status_value)
            return Response({"detail": f"Manual attendance marked successfully ({status_value})."}, status=status.HTTP_201_CREATED)
        except IntegrityError:
             return Response({"detail": "Attendance already marked for this student and lecture."}, status=status.HTTP_400_BAD_REQUEST)
        
    # --- ACTION REMOVED FROM AttendanceViewSet ---
    # @action(detail=True, methods=['get'], url_path='reports/course')
    # def reports_course(self, request, pk=None): ...