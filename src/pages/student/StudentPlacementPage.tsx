import React from 'react';
import {
  Student,
  Drive,
  Application,
  ApplicationStage,
} from '../../services/placementNoDuesService';
import { StatusChip } from '../../components/ui/StatusChip';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/FeedbackComponents';
import { useToast } from '../../components/ui/Toast';
import {
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Briefcase,
  ChevronRight,
  X,
} from 'lucide-react';

interface StudentPlacementPageProps {
  student: Student;
  drives: Drive[];
  applications: Application[];
  onRegisterDrive: (driveId: string) => void;
  onNavigateToNoDues: () => void;
  passwordChanged?: boolean;
  onNavigateToProfile?: () => void;
}

const STAGE_ORDER: ApplicationStage[] = [
  'Registered',
  'Eligibility Verified',
  'Shortlisted',
  'Assessment',
  'Interview',
  'Selected',
  'Offer',
  'Joined',
];

export const StudentPlacementPage: React.FC<StudentPlacementPageProps> = ({
  student,
  drives,
  applications,
  onRegisterDrive,
  onNavigateToNoDues,
  passwordChanged = false,
  onNavigateToProfile,
}) => {
  const { showToast } = useToast();
  const [isBannerDismissed, setIsBannerDismissed] = React.useState(false);

  // Student's own applications ONLY
  const myApplications = applications.filter((a) => a.studentId === student.id);

  // Student's published offers ONLY
  const myOffers = myApplications.filter(
    (a) => a.isOfferPublished && (a.stage === 'Offer' || a.stage === 'Joined')
  );

  // Open drives matching student's department and batch
  const openDrivesForMe = drives.filter(
    (d) =>
      d.status !== 'Cancelled' &&
      d.eligibleDepartments.includes(student.department) &&
      d.eligibleBatches.includes(student.batch)
  );

  // Counts for student's summary row
  const inProgressCount = myApplications.filter((a) =>
    ['Registered', 'Eligibility Verified', 'Shortlisted', 'Assessment', 'Interview'].includes(a.stage)
  ).length;
  const rejectedCount = myApplications.filter((a) =>
    ['Rejected', 'Withdrawn'].includes(a.stage)
  ).length;

  const todayStr = new Date().toISOString().split('T')[0];
  const showDefaultPasswordBanner = !passwordChanged && !isBannerDismissed;

  return (
    <div className="space-y-6">
      {/* DISMISSIBLE DEFAULT PASSWORD WARNING BANNER */}
      {showDefaultPasswordBanner && (
        <div
          role="alert"
          className="bg-[#FCF6EE] border border-[#F3DFC7] text-[#8C4F1A] rounded-[6px] p-3.5 flex items-center justify-between gap-3 transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <AlertTriangle className="w-4 h-4 text-[#C2501F] shrink-0" />
            <span className="text-xs font-medium text-[#1C1F1D]">
              You are using the default password. Please change it in Profile.
            </span>
            {onNavigateToProfile && (
              <button
                type="button"
                onClick={onNavigateToProfile}
                className="text-xs font-semibold text-[#C2501F] hover:underline cursor-pointer inline-flex items-center gap-0.5 ml-1"
              >
                <span>Change password</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsBannerDismissed(true)}
            aria-label="Dismiss banner"
            className="p-1 text-[#8C4F1A] hover:text-[#1C1F1D] rounded transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Candidate Header Card */}
      <div className="bg-white border border-[#E4DFD3] rounded-[6px] p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-serif text-2xl font-medium text-[#1C1F1D]">
                {student.name}
              </h1>
              <span className="font-mono text-xs text-[#6B6F6A] font-medium bg-[#FAF8F3] px-2 py-0.5 rounded border border-[#E4DFD3]">
                {student.rollNo}
              </span>
            </div>
            <p className="text-xs text-[#6B6F6A] mt-1">
              {student.program} in {student.department} · Year {student.year} (Section {student.section}) · Batch {student.batch}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <StatusChip
              status={student.isRegistered ? 'Registered' : 'Not Applicable'}
              label={student.isRegistered ? 'Registered on Portal' : 'Unregistered'}
            />
            <StatusChip
              status={student.isEligible ? 'Eligible' : 'Not Eligible'}
              label={student.isEligible ? 'Eligible for Drives' : 'Eligibility Disqualified'}
            />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[#F2EFE9] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block">
              Cumulative CGPA
            </span>
            <span className="font-serif text-lg font-medium text-[#1C1F1D] tabular-nums">
              {student.cgpa}
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block">
              Active Backlogs
            </span>
            <span className="font-serif text-lg font-medium text-[#1C1F1D] tabular-nums">
              {student.activeBacklogs}
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block">
              Registered Drives
            </span>
            <span className="font-serif text-lg font-medium text-[#1C1F1D] tabular-nums">
              {myApplications.length}
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block">
              Published Offers
            </span>
            <span className="font-serif text-lg font-medium text-[#1E5631] tabular-nums">
              {myOffers.length}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Progress Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card padding="md">
          <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block font-semibold">
            Applications
          </span>
          <span className="font-serif text-3xl font-medium text-[#1C1F1D] tabular-nums mt-1 block">
            {myApplications.length}
          </span>
          <p className="text-xs text-[#6B6F6A] mt-1">Total submitted</p>
        </Card>

        <Card padding="md">
          <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block font-semibold">
            In Progress
          </span>
          <span className="font-serif text-3xl font-medium text-[#8C5E09] tabular-nums mt-1 block">
            {inProgressCount}
          </span>
          <p className="text-xs text-[#6B6F6A] mt-1">Active evaluation</p>
        </Card>

        <Card padding="md">
          <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block font-semibold">
            Offers
          </span>
          <span className="font-serif text-3xl font-medium text-[#1E5631] tabular-nums mt-1 block">
            {myOffers.length}
          </span>
          <p className="text-xs text-[#6B6F6A] mt-1">Confirmed offers</p>
        </Card>

        <Card padding="md">
          <span className="text-[11px] uppercase tracking-wider text-[#6B6F6A] block font-semibold">
            Rejected / Withdrawn
          </span>
          <span className="font-serif text-3xl font-medium text-[#9E2A2B] tabular-nums mt-1 block">
            {rejectedCount}
          </span>
          <p className="text-xs text-[#6B6F6A] mt-1">Archived</p>
        </Card>
      </div>

      {/* 3. My Applications (Card list with horizontal stage tracker) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#E4DFD3]">
          <h2 className="font-serif text-xl font-medium text-[#1C1F1D]">
            My Applications
          </h2>
          <span className="text-xs text-[#6B6F6A]">
            {myApplications.length} submitted
          </span>
        </div>

        {myApplications.length === 0 ? (
          <EmptyState
            message="You have not registered for any recruitment drives yet."
            actionLabel="Browse Open Drives Below"
            onAction={() => {}}
          />
        ) : (
          <div className="space-y-4">
            {myApplications.map((app) => {
              const drive = drives.find((d) => d.id === app.driveId);
              const isRejected = app.stage === 'Rejected' || app.stage === 'Withdrawn';
              const currentStageIdx = STAGE_ORDER.indexOf(app.stage);

              return (
                <div
                  key={app.id}
                  className="bg-white border border-[#E4DFD3] rounded-[6px] p-5 space-y-4 shadow-none"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-lg font-medium text-[#1C1F1D]">
                          {app.company}
                        </span>
                        <StatusChip status={drive?.status || 'Open'} size="sm" />
                      </div>
                      <p className="text-xs text-[#6B6F6A] mt-0.5">{app.role}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusChip status={app.stage} />
                      {app.packageLpa && (
                        <span className="text-xs font-semibold text-[#1E5631] bg-[#EAF3ED] px-2 py-0.5 rounded tabular-nums">
                          ₹{app.packageLpa} LPA
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Stage Tracker */}
                  <div className="pt-2">
                    {isRejected ? (
                      <div className="p-2.5 bg-[#FCECEE] border border-[#F6C6CA] rounded-[4px] text-xs text-[#9E2A2B] flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>
                          Application marked as {app.stage}. Not moving forward in this recruitment cycle.
                        </span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto pb-2 no-scrollbar">
                        <div className="flex items-center min-w-[580px] justify-between">
                          {STAGE_ORDER.map((stageName, sIdx) => {
                            const isPast = sIdx < currentStageIdx;
                            const isCurrent = sIdx === currentStageIdx;

                            return (
                              <React.Fragment key={stageName}>
                                <div className="flex flex-col items-center text-center">
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                                      isPast
                                        ? 'bg-[#1F4D3F] text-white border-[#1F4D3F]'
                                        : isCurrent
                                        ? 'bg-white text-[#1F4D3F] border-[#1F4D3F] ring-2 ring-[#1F4D3F]/30'
                                        : 'bg-white text-[#6B6F6A] border-[#E4DFD3]'
                                    }`}
                                  >
                                    {isPast ? '✓' : sIdx + 1}
                                  </div>
                                  <span
                                    className={`text-[10px] mt-1.5 whitespace-nowrap ${
                                      isCurrent
                                        ? 'font-bold text-[#1C1F1D]'
                                        : 'text-[#6B6F6A]'
                                    }`}
                                  >
                                    {stageName}
                                  </span>
                                </div>

                                {sIdx < STAGE_ORDER.length - 1 && (
                                  <div
                                    className={`flex-1 h-[2px] mx-1 ${
                                      sIdx < currentStageIdx ? 'bg-[#1F4D3F]' : 'bg-[#E4DFD3]'
                                    }`}
                                  />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Next Date / Action banner */}
                  {app.nextActionDate && (
                    <div className="flex items-center gap-1.5 text-xs text-[#8C5E09] bg-[#FDF6E2] p-2 rounded border border-[#F3E3B5]">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Next round scheduled: {app.nextActionDate}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Open Drives for Me */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#E4DFD3]">
          <h2 className="font-serif text-xl font-medium text-[#1C1F1D]">
            Open Drives for My Department & Batch
          </h2>
          <span className="text-xs text-[#6B6F6A]">
            {openDrivesForMe.length} available
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {openDrivesForMe.map((drv) => {
            const isAlreadyRegistered = myApplications.some((a) => a.driveId === drv.id);
            const failsCgpa = student.cgpa < drv.minCgpa;
            const failsBacklogs = student.activeBacklogs > drv.maxBacklogs;
            const meetsCriteria = !failsCgpa && !failsBacklogs;
            const isDeadlinePassed = drv.deadline < todayStr;

            return (
              <div
                key={drv.id}
                className="bg-white border border-[#E4DFD3] rounded-[6px] p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-lg font-medium text-[#1C1F1D]">
                      {drv.company}
                    </span>
                    <span className="font-serif text-base font-semibold text-[#1F4D3F] tabular-nums">
                      ₹{drv.packageLpa} LPA
                    </span>
                  </div>
                  <p className="text-xs text-[#6B6F6A] mt-0.5">{drv.role}</p>
                  <p className="text-xs text-[#1C1F1D] mt-2 line-clamp-2">
                    {drv.description}
                  </p>

                  <div className="mt-3 pt-3 border-t border-[#F0EEE9] space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#6B6F6A]">Criteria:</span>
                      <span className="text-[#1C1F1D]">
                        Min {drv.minCgpa} CGPA · Max {drv.maxBacklogs} backlogs
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B6F6A]">Deadline:</span>
                      <span className="text-[#1C1F1D] tabular-nums">{drv.deadline}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B6F6A]">Location:</span>
                      <span className="text-[#1C1F1D]">{drv.location}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F0EEE9] flex items-center justify-between">
                  <div>
                    {meetsCriteria ? (
                      <span className="text-xs font-medium text-[#1E5631] bg-[#EAF3ED] px-2 py-0.5 rounded">
                        You meet the criteria
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-[#9E2A2B] bg-[#FCECEE] px-2 py-0.5 rounded">
                        {failsCgpa ? `Not eligible: CGPA below ${drv.minCgpa}` : 'Backlog cutoff failed'}
                      </span>
                    )}
                  </div>

                  <div>
                    {isAlreadyRegistered ? (
                      <span className="text-xs text-[#1F4D3F] font-semibold bg-[#FAF8F3] px-2.5 py-1 rounded border border-[#E4DFD3]">
                        Registered ✓
                      </span>
                    ) : isDeadlinePassed ? (
                      <Button variant="secondary" size="sm" disabled>
                        Deadline Passed
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!meetsCriteria}
                        onClick={() => {
                          onRegisterDrive(drv.id);
                          showToast({
                            type: 'success',
                            message: `Registered for ${drv.company} recruitment drive!`,
                          });
                        }}
                      >
                        Register
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. My Offers (Published only) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#E4DFD3]">
          <h2 className="font-serif text-xl font-medium text-[#1C1F1D]">
            My Official Offers
          </h2>
          <span className="text-xs text-[#6B6F6A]">
            {myOffers.length} published
          </span>
        </div>

        {myOffers.length === 0 ? (
          <EmptyState
            message="No published offers yet. When employers release verified letters of intent, they will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myOffers.map((o) => (
              <div
                key={o.id}
                className="bg-[#EAF3ED]/30 border border-[#CDE3D3] rounded-[6px] p-5 flex items-center justify-between"
              >
                <div>
                  <h3 className="font-serif text-lg font-medium text-[#1C1F1D]">
                    {o.company}
                  </h3>
                  <p className="text-xs text-[#6B6F6A]">{o.role}</p>
                  <p className="font-serif text-xl font-bold text-[#1E5631] mt-2 tabular-nums">
                    ₹{o.packageLpa} LPA
                  </p>
                </div>
                <div className="text-right">
                  <StatusChip status={o.stage} />
                  <p className="text-[11px] text-[#6B6F6A] mt-2 tabular-nums">
                    Issued: {o.updatedAt}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
