import { useCallback, useEffect, useState } from "react";
import { apiRequest, useCurrentMember } from "./api.js";
import {
  ActivityAdminActions,
  ActivityControls,
  ActivityHero,
  ActivityInformation,
  ActivityResults,
  RemoveActivityDialog,
} from "./ActivityPageComponents.jsx";
import {
  activitiesPerPage,
  addCalendarDays,
  compareActivities,
  getTodayDate,
} from "./activityUtils.js";
import "./Activities.css";

export default function Activities() {
  const [activityList, setActivityList] = useState([]);
  const [periodFilter, setPeriodFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [sortBy, setSortBy] = useState("date");
  const [sortDirection, setSortDirection] = useState("ascending");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isEditingActivities, setIsEditingActivities] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [activityLoadError, setActivityLoadError] = useState("");
  const [activityActionError, setActivityActionError] = useState("");
  const [activityPendingRemoval, setActivityPendingRemoval] = useState(null);
  const [removalConfirmationStage, setRemovalConfirmationStage] = useState(1);
  const [isRemovingActivity, setIsRemovingActivity] = useState(false);
  const todayDate = getTodayDate();
  const member = useCurrentMember();

  const activityListPath = isAdminAuthenticated ? "/activities?scope=all" : "/activities";
  const reloadActivities = useCallback(
    () => apiRequest(activityListPath).then(setActivityList).catch((loadError) => setActivityActionError(loadError.message)),
    [activityListPath],
  );

  function toggleAdvancedOptions() {
    if (isAdvancedOpen) {
      setCustomStartDate("");
      setCustomEndDate("");
      setCurrentPage(1);
    }
    setIsAdvancedOpen(!isAdvancedOpen);
  }

  const filteredActivities = activityList.filter((activity) => {
    const matchesPeriod = {
      today: activity.date === todayDate,
      "next-seven-days": activity.date >= todayDate && activity.date <= addCalendarDays(todayDate, 6),
      "next-thirty-days": activity.date >= todayDate && activity.date <= addCalendarDays(todayDate, 29),
    }[periodFilter] ?? true;
    return matchesPeriod && (!customStartDate || activity.date >= customStartDate) &&
      (!customEndDate || activity.date <= customEndDate);
  }).sort((first, second) => compareActivities(first, second, sortBy, sortDirection));
  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / activitiesPerPage));
  const visiblePage = Math.min(currentPage, totalPages);
  const visibleActivities = filteredActivities.slice(
    (visiblePage - 1) * activitiesPerPage,
    visiblePage * activitiesPerPage
  );

  const refreshAdminSession = useCallback(async () => {
    try {
      await apiRequest("/auth/me");
      setIsAdminAuthenticated(true);
    } catch (sessionError) {
      setIsAdminAuthenticated(false);
      if (sessionError.status !== 401) setActivityActionError(sessionError.message);
    }
  }, []);

  useEffect(() => {
    let isComponentMounted = true;
    apiRequest("/auth/me").catch((sessionError) => {
      if (sessionError.status !== 401) throw sessionError;
      return null;
    })
      .then(async (adminSession) => [await apiRequest(adminSession ? "/activities?scope=all" : "/activities"), adminSession])
      .then(([loadedActivities, adminSession]) => {
        if (!isComponentMounted) return;
        if (!Array.isArray(loadedActivities)) throw new Error("Aktivitetslisten har et ugyldig format.");
        setActivityList(loadedActivities);
        setIsAdminAuthenticated(Boolean(adminSession));
      }).catch((loadError) => {
        if (isComponentMounted) setActivityLoadError(loadError.message);
      })
      .finally(() => {
        if (isComponentMounted) setIsLoadingActivities(false);
      });

    window.addEventListener("set18-auth-change", refreshAdminSession);
    return () => {
      isComponentMounted = false;
      window.removeEventListener("set18-auth-change", refreshAdminSession);
    };
  }, [refreshAdminSession]);

  function beginActivityRemoval(activityToRemove) {
    setActivityActionError("");
    setActivityPendingRemoval(activityToRemove);
    setRemovalConfirmationStage(1);
  }

  async function confirmActivityRemoval() {
    if (!activityPendingRemoval) return;
    if (removalConfirmationStage === 1) {
      setRemovalConfirmationStage(2);
      return;
    }
    setIsRemovingActivity(true);
    setActivityActionError("");
    try {
      await apiRequest(`/activities/${encodeURIComponent(activityPendingRemoval.id)}`, { method: "DELETE" });
      setActivityList((currentActivities) =>
        currentActivities.filter((activityData) => activityData.id !== activityPendingRemoval.id)
      );
      setActivityPendingRemoval(null);
      setRemovalConfirmationStage(1);
    } catch (removalError) {
      setActivityActionError(removalError.message);
      setActivityPendingRemoval(null);
      setRemovalConfirmationStage(1);
    } finally {
      setIsRemovingActivity(false);
    }
  }

  function cancelActivityRemoval() {
    if (isRemovingActivity) return;
    setActivityPendingRemoval(null);
    setRemovalConfirmationStage(1);
  }

  function toggleActivityEditing() {
    setActivityActionError("");
    setIsEditingActivities((currentlyEditing) => !currentlyEditing);
  }

  return (
    <main className="activities-page">
      <ActivityHero />
      <section className="upcoming-activities" id="kommende">
        <header className="activities-heading">
          <section>
            <p className="activities-label">Hva skjer framover?</p>
            <h2>Kommende aktiviteter</h2>
          </section>
          <span className="activity-count">
            {filteredActivities.length} av {activityList.length} aktiviteter
          </span>
        </header>
        <ActivityControls
          periodFilter={periodFilter}
          sortBy={sortBy}
          sortDirection={sortDirection}
          isAdvancedOpen={isAdvancedOpen}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onPeriodChange={(value) => {
            setPeriodFilter(value);
            setCurrentPage(1);
          }}
          onSortByChange={(value) => {
            setSortBy(value);
            setCurrentPage(1);
          }}
          onSortDirectionChange={(value) => {
            setSortDirection(value);
            setCurrentPage(1);
          }}
          onAdvancedToggle={toggleAdvancedOptions}
          onStartDateChange={(value) => {
            setCustomStartDate(value);
            setCurrentPage(1);
          }}
          onEndDateChange={(value) => {
            setCustomEndDate(value);
            setCurrentPage(1);
          }}
        />
        <ActivityResults
          activityLoadError={activityLoadError}
          activityActionError={activityActionError}
          isLoading={isLoadingActivities}
          activityCount={activityList.length}
          filteredActivities={filteredActivities}
          visibleActivities={visibleActivities}
          totalPages={totalPages}
          visiblePage={visiblePage}
          showEditControls={isEditingActivities && isAdminAuthenticated}
          member={member}
          isAdmin={isAdminAuthenticated}
          onRemove={beginActivityRemoval}
          onPurchased={reloadActivities}
          onPageChange={setCurrentPage}
        />
        <ActivityInformation />
        <ActivityAdminActions
          isAdmin={isAdminAuthenticated}
          isEditing={isEditingActivities}
          onToggleEditing={toggleActivityEditing}
        />
      </section>
      <RemoveActivityDialog
        activityToRemove={activityPendingRemoval}
        confirmationStage={removalConfirmationStage}
        isRemoving={isRemovingActivity}
        onCancelRemoval={cancelActivityRemoval}
        onConfirmRemoval={confirmActivityRemoval}
      />
    </main>
  );
}
