import { useEffect, useState } from "react";
import { apiRequest, useCurrentMember } from "./api.js";
import {
  ActivityAdminActions,
  ActivityHero,
  ActivityInformation,
  ActivityListItem,
  ActivityResults,
  RemoveActivityDialog,
} from "./ActivityPageComponents.jsx";
import { FilterControls } from "./FilterControls.jsx";
import {
  activitiesPerPage,
} from "./activityUtils.js";
import {
  compareActivities,
  getTodayDate,
  matchesDateFilter,
} from "./dateSortFilters.js";
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

  function toggleAdvancedOptions() {
    if (isAdvancedOpen) {
      setCustomStartDate("");
      setCustomEndDate("");
      setCurrentPage(1);
    }
    setIsAdvancedOpen(!isAdvancedOpen);
  }

  const activeActivities = activityList.filter((activity) =>
    activity.status !== "archived" && (isAdminAuthenticated || (activity.status ?? "published") === "published"));
  const archivedActivities = isAdminAuthenticated ? activityList.filter((activity) => activity.status === "archived") : [];
  const filteredActivities = activeActivities.filter((activity) =>
    matchesDateFilter(activity.date, todayDate, periodFilter, customStartDate, customEndDate)
  ).sort((first, second) => compareActivities(first, second, sortBy, sortDirection));
  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / activitiesPerPage));
  const visiblePage = Math.min(currentPage, totalPages);
  const visibleActivities = filteredActivities.slice(
    (visiblePage - 1) * activitiesPerPage,
    visiblePage * activitiesPerPage
  );

  useEffect(() => {
    let isComponentMounted = true;
    let requestSequence = 0;
    function refreshActivities() {
      const sequence = ++requestSequence;
      apiRequest("/auth/me").catch((sessionError) => {
        if (sessionError.status !== 401) throw sessionError;
        return null;
      })
        .then(async (adminSession) => [await apiRequest(adminSession ? "/activities?scope=all" : "/activities"), adminSession])
        .then(([loadedActivities, adminSession]) => {
          if (!isComponentMounted || sequence !== requestSequence) return;
          if (!Array.isArray(loadedActivities)) throw new Error("Aktivitetslisten har et ugyldig format.");
          setActivityLoadError("");
          setActivityList(loadedActivities);
          setIsAdminAuthenticated(Boolean(adminSession));
        }).catch((loadError) => {
          if (isComponentMounted && sequence === requestSequence) {
            setIsAdminAuthenticated(false);
            setActivityList([]);
            setActivityLoadError(loadError.message);
          }
        })
        .finally(() => {
          if (isComponentMounted && sequence === requestSequence) setIsLoadingActivities(false);
        });
    }

    refreshActivities();
    function sessionChanged() {
      setIsAdminAuthenticated(false);
      setActivityList((current) => current.filter((item) => (item.status ?? "published") === "published"));
      refreshActivities();
    }
    window.addEventListener("set18-auth-change", sessionChanged);
    return () => {
      isComponentMounted = false;
      window.removeEventListener("set18-auth-change", sessionChanged);
    };
  }, []);

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
      setActivityList((currentActivities) => currentActivities.map((activityData) =>
        activityData.id === activityPendingRemoval.id ? { ...activityData, status: "archived" } : activityData));
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
            {filteredActivities.length} av {activeActivities.length} aktiviteter
          </span>
        </header>
        <FilterControls
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
          activityCount={activeActivities.length}
          filteredActivities={filteredActivities}
          visibleActivities={visibleActivities}
          totalPages={totalPages}
          visiblePage={visiblePage}
          showEditControls={isEditingActivities && isAdminAuthenticated}
          member={member}
          isAdmin={isAdminAuthenticated}
          onRemove={beginActivityRemoval}
          onPageChange={setCurrentPage}
        />
        <ActivityInformation />
        <ActivityAdminActions
          isAdmin={isAdminAuthenticated}
          isEditing={isEditingActivities}
          onToggleEditing={toggleActivityEditing}
        />
        {isAdminAuthenticated && !isLoadingActivities && (
          <section className="activity-archive" aria-labelledby="activity-archive-title">
            <h2 id="activity-archive-title">Arkiv for aktiviteter</h2>
            <p>Arkiverte aktiviteter er bare synlige for administratorer.</p>
            {archivedActivities.length === 0
              ? <p>Ingen arkiverte aktiviteter.</p>
              : <section className="activity-list" aria-label="Arkiverte aktiviteter">
                {archivedActivities.map((activity, index) => (
                  <ActivityListItem key={activity.id} activity={activity} index={index} showEditControls member={member} isAdmin />
                ))}
              </section>}
          </section>
        )}
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
